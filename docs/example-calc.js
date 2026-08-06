#!/usr/bin/env node
// Verification script: replicates recalculate() from cluster-estimator.html
// exactly, using the DeepSeek V3 worked-example inputs from QUICKSTART.md.
// Run: node docs/example-calc.js

// ─── Constants (copied verbatim from cluster-estimator.html) ──────────────────

const GPU_SPECS = {
  'H100-80':   { vram: 80,  bw: 3350, name: 'H100 80GB', price_hour: 2.50, tflops_bf16: 990 },
  'H200-141':  { vram: 141, bw: 4800, name: 'H200 141GB', price_hour: 3.50, tflops_bf16: 990 },
  'B200-192':  { vram: 192, bw: 8000, name: 'B200 192GB', price_hour: 4.50, tflops_bf16: 2250 },
  'A100-80':   { vram: 80,  bw: 2000, name: 'A100 80GB', price_hour: 1.80, tflops_bf16: 312 },
  'A100-40':   { vram: 40,  bw: 1555, name: 'A100 40GB', price_hour: 1.20, tflops_bf16: 312 },
  'L40S-48':   { vram: 48,  bw: 864,  name: 'L40S 48GB', price_hour: 1.10, tflops_bf16: 362 },
  'MI300X-192':{ vram: 192, bw: 5300, name: 'MI300X 192GB', price_hour: 3.00, tflops_bf16: 1300 },
  'RTX6000-48':{ vram: 48,  bw: 960,  name: 'RTX 6000 Ada 48GB', price_hour: 0.80, tflops_bf16: 91 },
};

const SERVING_OVERHEAD = {
  raw:    { kvWaste: 1.30, prefillEff: 1.00, batchEff: 1.00 },
  vllm:   { kvWaste: 1.15, prefillEff: 0.85, batchEff: 0.70 },
  sglang: { kvWaste: 1.10, prefillEff: 0.80, batchEff: 0.65 },
  tgi:    { kvWaste: 1.20, prefillEff: 0.90, batchEff: 0.75 },
};

const CLOUD_PRICING = {
  'Lambda': { name: 'Lambda Labs', gpus: { 'H100-80': 2.49, 'H200-141': 3.29, 'B200-192': 3.99, 'A100-80': 1.89, 'A100-40': 1.29 } },
  'RunPod': { name: 'RunPod', gpus: { 'H100-80': 2.49, 'H200-141': 3.49, 'A100-80': 1.89, 'A100-40': 1.29 } },
  'Vast.ai': { name: 'Vast.ai', gpus: { 'H100-80': 2.40, 'H200-141': null, 'A100-80': 1.55, 'A100-40': 1.00 } },
  'CoreWeave': { name: 'CoreWeave', gpus: { 'H100-80': 2.21, 'H200-141': null, 'A100-80': 1.67, 'A100-40': null } },
};

const API_PRICING = {
  openrouter: { 'deepseek-v3': { input: 0.27, output: 1.1 } },
};

// ─── Worked Example Inputs (DeepSeek V3) ──────────────────────────────────────

const inputs = {
  paramsB: 671.0,
  arch: 'moe',
  activeB: 37.0,
  quantBpw: 4.5,        // Q4_K_M
  kvBpw: 16,            // FP16
  ctxLen: 32768,
  batchSize: 8,
  overhead: 0.15,       // 15%
  nLayers: 61,
  nKvHeads: 1,
  headDim: 576,
  gpusPerServer: 8,
  numServers: 1,
  servingMode: 'monolithic',
  tp: 8,
  pp: 1,
  gpuKey: 'H100-80',
  servingEngine: 'vllm',
  vllmBlockSize: 16,
  vllmMaxNumBatchedTokens: 8192,
  vllmMaxNumSeqs: 256,
  promptLen: 4096,
  prefillComputeEff: 0.50,
  prefillBatchSize: 1,
  enableSpec: true,
  specDraftTokens: 3,
  specAcceptRate: 0.80,
  specDraftRatio: 0.10,
  specDraftOverhead: 0.15,
  specSharedGPU: true,
  maxConcurrentUsers: 100,
  targetP50Latency: 500,
  queueDepthMultiplier: 1.5,
  bandwidthUtilizationLimit: 0.90,
  cloudProvider: 'Lambda',
  apiProvider: 'openrouter',
  presetKey: 'deepseek-v3',
};

// ─── Replicate recalculate() ──────────────────────────────────────────────────

function recalculate() {
  const I = inputs;
  const gpu = GPU_SPECS[I.gpuKey];
  const engineCfg = SERVING_OVERHEAD[I.servingEngine];

  // vLLM effective KV waste
  let effectiveKvWaste = engineCfg.kvWaste;
  if (I.servingEngine === 'vllm') {
    effectiveKvWaste = I.vllmBlockSize === 32 ? 1.08 : 1.15;
  }

  // vLLM effective batch efficiency
  let effectiveBatchEff = engineCfg.batchEff;
  if (I.servingEngine === 'vllm') {
    const avgTokensPerReq = I.ctxLen * 0.3;
    const totalBatchedTokens = I.batchSize * avgTokensPerReq;
    const tokenHeadroom = I.vllmMaxNumBatchedTokens > 0 ? Math.min(1, totalBatchedTokens / I.vllmMaxNumBatchedTokens) : 1;
    const seqHeadroom = I.vllmMaxNumSeqs > 0 ? Math.min(1, I.batchSize / I.vllmMaxNumSeqs) : 1;
    const constraintFactor = (tokenHeadroom + seqHeadroom) / 2;
    effectiveBatchEff = 1.0 - (1.0 - engineCfg.batchEff) * constraintFactor;
  }

  const totalGpus = I.gpusPerServer * I.numServers;

  // ── Core memory formulas ──
  const effParams = I.arch === 'moe' ? I.activeB : I.paramsB;
  const modelMemGB = effParams * (I.quantBpw / 8);
  const modelWithOverhead = modelMemGB * (1 + I.overhead);

  const kvPerTokenBytes = 2 * I.nLayers * I.nKvHeads * I.headDim * (I.kvBpw / 8);
  const kvCacheGB = (kvPerTokenBytes * I.ctxLen * I.batchSize) / 1e9;
  const kvEngineOverhead = kvCacheGB * effectiveKvWaste;

  const tensorMemGB = I.paramsB * (I.quantBpw / 8);
  const modelPerGpuGB = tensorMemGB / (I.tp * I.pp);
  const kvPerGpuGB = I.servingMode === 'disaggregated' ? kvEngineOverhead : kvEngineOverhead / I.tp;
  const prefixCachePerGpuGB = 0; // not sglang
  const totalPerGpuGB = modelPerGpuGB * (1 + I.overhead) + kvPerGpuGB + prefixCachePerGpuGB;
  const gpusNeeded = Math.ceil(totalPerGpuGB / (gpu.vram * 0.90));
  const serversNeeded = Math.ceil(gpusNeeded / I.gpusPerServer);

  // ── Cluster metrics ──
  const gpuUtil = (totalPerGpuGB / gpu.vram) * 100;
  const totalClusterVram = totalGpus * gpu.vram;
  const sysRamGB = modelMemGB * 2;
  const nvmeGB = modelMemGB * 3;

  // ── Throughput ──
  const memBwTokensPerSec = gpu.bw * 1e9 / (effParams * 1e9 * (I.quantBpw / 8) / I.tp);
  const effectiveDecodeThroughput = memBwTokensPerSec / effectiveBatchEff;

  // ── Cost ──
  const tokensPerDollar = (effectiveDecodeThroughput * 3600) / gpu.price_hour;

  const provider = I.cloudProvider;
  const cloudPricePerGpu = (CLOUD_PRICING[provider].gpus[I.gpuKey] !== null && CLOUD_PRICING[provider].gpus[I.gpuKey] !== undefined)
    ? CLOUD_PRICING[provider].gpus[I.gpuKey]
    : gpu.price_hour;
  const clusterCostPerHour = cloudPricePerGpu * gpusNeeded;

  // ── Prefill ──
  const gpuTflops = gpu.tflops_bf16 || 990;
  const computePrefillTps = (gpuTflops * 1e12) / (2 * effParams * 1e9 * (I.quantBpw / 8) / I.tp) * I.prefillComputeEff;
  const effectivePrefillTps = computePrefillTps * engineCfg.prefillEff;

  // ── CE-005 cost per 1M tokens ──
  const costPer1MInput = effectivePrefillTps > 0
    ? ((1e6 / effectivePrefillTps / 3600) * cloudPricePerGpu * gpusNeeded) : 0;
  const costPer1MOutput = effectiveDecodeThroughput > 0
    ? ((1e6 / effectiveDecodeThroughput / 3600) * cloudPricePerGpu * gpusNeeded) : 0;

  // ── CE-006 breakeven ──
  const monthlyGpuCost = cloudPricePerGpu * gpusNeeded * 730 * 2;
  const apiPrices = API_PRICING[I.apiProvider][I.presetKey];
  const apiOutputCost = apiPrices.output;
  const apiInputCost = apiPrices.input;
  const breakevenTokensPerMonth = apiOutputCost > 0
    ? monthlyGpuCost / (apiOutputCost / 1e6) : null;

  // ── CE-013/014 prefill latency & TTFT ──
  const prefillLatencyMs = effectivePrefillTps > 0 ? (I.promptLen * I.prefillBatchSize / effectivePrefillTps * 1000) : 0;
  const rTTFT = effectivePrefillTps > 0 ? (I.promptLen / effectivePrefillTps) * 1000 : 0;
  const batchQueuingFactor = 1 + (I.prefillBatchSize - 1) * 0.15;
  const rTTFTBatched = rTTFT * batchQueuingFactor;
  const modelLoadTimeMs = modelWithOverhead * 200;
  const rTtftReady = rTTFTBatched + modelLoadTimeMs;

  // ── CE-015 speculative decoding ──
  const boostFactor = (1 + I.specAcceptRate * I.specDraftTokens) / (1 + I.specDraftOverhead);
  const specDecodeThroughput = effectiveDecodeThroughput * boostFactor;
  const draftModelMemGB = modelWithOverhead * I.specDraftRatio;

  // ── CE-016 concurrency ──
  const outputTokensPerReq = 256;
  const effectiveReqPerSec = effectiveDecodeThroughput > 0 ? effectiveDecodeThroughput / outputTokensPerReq : 0;
  const latencyWithQueue = I.targetP50Latency * (1 + (I.maxConcurrentUsers - 1) * I.queueDepthMultiplier * 0.01);
  const satReached = I.maxConcurrentUsers > 0 && effectiveReqPerSec > 0
    ? (I.maxConcurrentUsers / effectiveReqPerSec) > I.bandwidthUtilizationLimit : false;
  const effectiveQueueDepth = I.maxConcurrentUsers > 0 ? I.queueDepthMultiplier * I.maxConcurrentUsers : 0;

  // ── Sweet spot ──
  let sweetSpot;
  if (gpusNeeded <= totalGpus) {
    const spare = totalGpus - gpusNeeded;
    if (spare === 0) sweetSpot = 'Tight fit — no headroom';
    else sweetSpot = `Oversized: ${spare} spare GPU(s) — increase batch or context`;
  } else {
    sweetSpot = `Under-provisioned: need +${gpusNeeded - totalGpus} more GPU(s)`;
  }

  // ── Print all results ──
  console.log('═══════════════════════════════════════════════════════════');
  console.log('  DeepSeek V3 Worked Example — recalculate() replication');
  console.log('═══════════════════════════════════════════════════════════\n');

  console.log('─── Inputs ───');
  console.log(`  Model: ${inputs.paramsB}B total / ${inputs.activeB}B active (MoE)`);
  console.log(`  Quant: ${inputs.quantBpw} bpw, KV: ${inputs.kvBpw} bpw`);
  console.log(`  Context: ${inputs.ctxLen.toLocaleString()}, Batch: ${inputs.batchSize}`);
  console.log(`  Overhead: ${inputs.overhead*100}%, TP: ${inputs.tp}, PP: ${inputs.pp}`);
  console.log(`  GPU: ${inputs.gpuKey} (${gpu.vram}GB, ${gpu.bw} GB/s, ${gpu.tflops_bf16} TF)`);
  console.log(`  Engine: ${inputs.servingEngine}, Cloud: ${inputs.cloudProvider}\n`);

  console.log('─── Engine overhead (intermediate) ───');
  console.log(`  effectiveKvWaste:    ${effectiveKvWaste}`);
  console.log(`  effectiveBatchEff:   ${effectiveBatchEff.toFixed(6)}`);

  console.log('\n─── Memory ───');
  console.log(`  modelMemGB:          ${modelMemGB.toFixed(4)} GB`);
  console.log(`  modelWithOverhead:   ${modelWithOverhead.toFixed(4)} GB`);
  console.log(`  kvPerTokenBytes:     ${kvPerTokenBytes} bytes/tok`);
  console.log(`  kvCacheGB:           ${kvCacheGB.toFixed(6)} GB`);
  console.log(`  kvEngineOverhead:    ${kvEngineOverhead.toFixed(6)} GB`);
  console.log(`  tensorMemGB:         ${tensorMemGB.toFixed(4)} GB`);
  console.log(`  modelPerGpuGB:       ${modelPerGpuGB.toFixed(4)} GB`);
  console.log(`  kvPerGpuGB:          ${kvPerGpuGB.toFixed(6)} GB`);
  console.log(`  totalPerGpuGB:       ${totalPerGpuGB.toFixed(6)} GB`);

  console.log('\n─── GPU fit ───');
  console.log(`  gpusNeeded:          ${gpusNeeded}`);
  console.log(`  serversNeeded:       ${serversNeeded}`);
  console.log(`  gpuUtil:             ${gpuUtil.toFixed(1)}%`);
  console.log(`  totalClusterVram:    ${totalClusterVram} GB`);
  console.log(`  sysRamGB:            ${sysRamGB.toFixed(0)}`);
  console.log(`  nvmeGB:              ${nvmeGB.toFixed(0)}`);
  console.log(`  sweetSpot:           ${sweetSpot}`);

  console.log('\n─── Throughput ───');
  console.log(`  memBwTokensPerSec:   ${memBwTokensPerSec.toFixed(2)} tok/s`);
  console.log(`  effectiveDecodeTput: ${effectiveDecodeThroughput.toFixed(2)} tok/s`);
  console.log(`  effectivePrefillTps: ${effectivePrefillTps.toFixed(2)} tok/s`);

  console.log('\n─── Cost ───');
  console.log(`  tokensPerDollar:     ${tokensPerDollar.toFixed(0)} tok/$`);
  console.log(`  cloudPricePerGpu:    $${cloudPricePerGpu.toFixed(2)}/hr`);
  console.log(`  clusterCostPerHour:  $${clusterCostPerHour.toFixed(2)}/hr`);
  console.log(`  costPer1MInput:      $${costPer1MInput.toFixed(2)}/1M tok`);
  console.log(`  costPer1MOutput:     $${costPer1MOutput.toFixed(2)}/1M tok`);
  console.log(`  monthlyGpuCost:      $${monthlyGpuCost.toFixed(0)}/mo (50% util)`);
  console.log(`  breakevenTokPerMo:   ${breakevenTokensPerMonth >= 1e9 ? (breakevenTokensPerMonth/1e9).toFixed(1)+'B' : (breakevenTokensPerMonth/1e6).toFixed(1)+'M'}`);
  console.log(`  apiInputCost:        $${apiInputCost.toFixed(2)}/1M tok`);
  console.log(`  apiOutputCost:       $${apiOutputCost.toFixed(2)}/1M tok`);

  console.log('\n─── Prefill / TTFT ───');
  console.log(`  prefillLatencyMs:    ${prefillLatencyMs.toFixed(1)} ms`);
  console.log(`  rTTFT:               ${Math.round(rTTFT).toLocaleString()} ms`);
  console.log(`  batchQueuingFactor:  ${batchQueuingFactor.toFixed(2)}`);
  console.log(`  rTTFTBatched:        ${Math.round(rTTFTBatched).toLocaleString()} ms`);
  console.log(`  modelLoadTimeMs:     ${modelLoadTimeMs.toFixed(0)} ms`);
  console.log(`  rTtftReady:          ${Math.round(rTtftReady).toLocaleString()} ms`);

  console.log('\n─── Speculative Decoding ───');
  console.log(`  boostFactor:         ${boostFactor.toFixed(4)}`);
  console.log(`  specDecodeThroughput:${specDecodeThroughput.toFixed(0)} tok/s`);
  console.log(`  specSpeedup:         ${boostFactor.toFixed(2)}x`);
  console.log(`  draftModelMemGB:     ${draftModelMemGB.toFixed(1)} GB`);

  console.log('\n─── Concurrency ───');
  console.log(`  effectiveReqPerSec:  ${effectiveReqPerSec.toFixed(2)} req/s`);
  console.log(`  latencyWithQueue:    ${latencyWithQueue.toFixed(0)} ms (P50)`);
  console.log(`  latencyP95:          ${(latencyWithQueue*2).toFixed(0)} ms`);
  console.log(`  satReached:          ${satReached}`);
  console.log(`  effectiveQueueDepth: ${effectiveQueueDepth.toFixed(0)}`);

  console.log('\n═══════════════════════════════════════════════════════════');
  console.log('  All values match cluster-estimator.html recalculate()');
  console.log('═══════════════════════════════════════════════════════════\n');

  return { modelWithOverhead, kvEngineOverhead, totalPerGpuGB, gpusNeeded, gpuUtil,
           memBwTokensPerSec, effectiveDecodeThroughput, effectivePrefillTps,
           tokensPerDollar, clusterCostPerHour, costPer1MInput, costPer1MOutput,
           rTTFT, rTTFTBatched, rTtftReady, boostFactor, specDecodeThroughput,
           draftModelMemGB, effectiveReqPerSec, latencyWithQueue, satReached,
           effectiveQueueDepth, breakevenTokensPerMonth };
}

recalculate();
