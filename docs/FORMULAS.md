# Inference Cluster Estimator — Formula & Methodology Reference

This document describes **every output metric** the tool computes, with the
exact formula used in `recalculate()` (cluster-estimator.html, lines
~1177–1759). All formulas are derived directly from the source code — nothing
is invented. Where a constant feeds the formula, its value and source constant
object are cited.

> **Variable notation:** variables prefixed with `I.` are user inputs read from
> DOM elements (e.g. `I.paramsB` = the "params" field). Variables prefixed with
> `C.` are constants (e.g. `C.GPU_SPECS`). Intermediate variables use plain
> names (e.g. `modelMemGB`).

---

## Table of Contents

1. [Constants Reference Tables](#1-constants-reference-tables)
2. [Model Memory](#2-model-memory)
3. [KV Cache](#3-kv-cache)
4. [GPU Fit (Per-GPU Memory & GPU Count)](#4-gpu-fit)
5. [GPU Count & Sweet-Spot Analysis](#5-gpu-count--sweet-spot-analysis)
6. [System RAM & NVMe Cache](#6-system-ram--nvme-cache)
7. [Decode Throughput (Memory-Bandwidth Bound)](#7-decode-throughput)
8. [Tokens per Dollar](#8-tokens-per-dollar)
9. [Cost per 1M Tokens (CE-005)](#9-cost-per-1m-tokens-ce-005)
10. [Cluster Cost per Hour](#10-cluster-cost-per-hour)
11. [Prefill Throughput (CE-013)](#11-prefill-throughput-ce-013)
12. [Prefill Latency & TTFT (CE-013/CE-014)](#12-prefill-latency--ttft)
13. [Speculative Decoding (CE-015)](#13-speculative-decoding-ce-015)
14. [Concurrent Users (CE-016)](#14-concurrent-users-ce-016)
15. [Serving Engine Overhead (CE-007)](#15-serving-engine-overhead-ce-007)
16. [SGLang RadixAttention (CE-008)](#16-sglang-radixattention-ce-008)
17. [TGI Continuous Batching (CE-009)](#17-tgi-continuous-batching-ce-009)
18. [Expert Parallelism / MoE (CE-012)](#18-expert-parallelism--moe-ce-012)
19. [NVLink Topology (CE-010)](#19-nvlink-topology-ce-010)
20. [Multi-Node Scaling (CE-011)](#20-multi-node-scaling-ce-011)
21. [Cloud Provider Pricing Table](#21-cloud-provider-pricing-table)
22. [API Pricing & Breakeven vs Self-Hosted (CE-006)](#22-api-pricing--breakeven)

---

## 1. Constants Reference Tables

These constants are defined at the top of the `<script>` block and feed the
formulas below. All values are as they appear in the source code.

### 1.1 GPU_SPECS

| Key | VRAM (GB) | Bandwidth (GB/s) | Price ($/hr) | TFLOPS BF16 |
|-----|-----------|-------------------|--------------|-------------|
| H100-80 | 80 | 3,350 | 2.50 | 990 |
| H200-141 | 141 | 4,800 | 3.50 | 990 |
| B200-192 | 192 | 8,000 | 4.50 | 2,250 |
| A100-80 | 80 | 2,000 | 1.80 | 312 |
| A100-40 | 40 | 1,555 | 1.20 | 312 |
| L40S-48 | 48 | 864 | 1.10 | 362 |
| MI300X-192 | 192 | 5,300 | 3.00 | 1,300 |
| RTX6000-48 | 48 | 960 | 0.80 | 91 |

Custom GPU default: `{ vram: 80, bw: 2000, price_hour: 2.00, tflops_bf16: 312 }`.

### 1.2 Quantization Bit Widths (from the `<select id="quant">` options)

| Option | Bits per weight (bpw) |
|--------|-----------------------|
| IQ2_XXS | 2.0 |
| IQ3_XXS | 2.5 |
| Q4_0 | 4.0 |
| Q4_K_M | 4.5 |
| Q5_K_M | 5.0 |
| Q6_K | 6.0 |
| Q8_0 | 8.0 |
| FP16 | 16.0 |
| FP32 | 32.0 |

### 1.3 KV Cache Precision Multipliers (from `<select id="kvPrecision">`)

| Option | Bits per weight (kvBpw) |
|--------|------------------------|
| FP4 | 4 |
| FP8 | 8 |
| FP16 | 16 |

### 1.4 NVLink_TOPOLOGY

| Key | Name | Intra-node BW (GB/s) | Inter-node BW (GB/s) | Type |
|-----|------|-----------------------|-----------------------|------|
| nvlink-900 | NVLink 4.0 | 900 | 50 | nvlink |
| nvlink-1800 | NVSwitch | 1,800 | 100 | nvswitch |
| pcie-5 | PCIe 5.0 | 128 | 25 | pcie |
| infiniband | InfiniBand NDR400 | 400 | 400 | ib |

### 1.5 SERVING_OVERHEAD

| Engine | kvWaste | prefillEff | batchEff |
|--------|---------|------------|----------|
| raw | 1.30 | 1.00 | 1.00 |
| vllm | 1.15 | 0.85 | 0.70 |
| sglang | 1.10 | 0.80 | 0.65 |
| tgi | 1.20 | 0.90 | 0.75 |

### 1.6 Other Constants

| Constant | Value |
|----------|-------|
| TGI_DEFAULTS.maxBatchSize | 128 |
| TGI_DEFAULTS.maxWaitingSequences | 256 |
| TGI_DEFAULTS.maxTotalTokens | 65,536 |
| SGLANG_RADIX.cacheHitRate | 0.50 |
| SGLANG_RADIX.prefixCacheSize | 4 (GB) |
| SGLANG_RADIX.radixTreeOverhead | 0.05 |
| MOE_EXPERT_CONFIG.defaultNumExperts | 8 |
| MOE_EXPERT_CONFIG.defaultTopK | 2 |
| MOE_EXPERT_CONFIG.expertDispatchOverhead | 0.05 |
| MOE_EXPERT_CONFIG.expertLoadBalanceOverhead | 0.10 |
| SCALING_EFFICIENCY.ncclAllReduceBaseLatency | 10 (μs) |
| SCALING_EFFICIENCY.ncclBandwidthUtilization | 0.80 |
| SCALING_EFFICIENCY.pipelineBubbleOverhead | 0.15 |
| SCALING_EFFICIENCY.scalingEfficiencyCurve | {1: 1.0, 2: 0.95, 4: 0.88, 8: 0.78, 16: 0.65, 32: 0.50, 64: 0.35, 128: 0.22} |
| SPECULATIVE_DECODING.draftTokensPerStep | 3 |
| SPECULATIVE_DECODING.draftModelRatio | 0.10 |
| SPECULATIVE_DECODING.acceptanceRate | 0.80 |
| SPECULATIVE_DECODING.draftOverhead | 0.15 |
| CONCURRENCY_MODEL.maxConcurrentUsers | 100 |
| CONCURRENCY_MODEL.targetP50Latency | 500 (ms) |
| CONCURRENCY_MODEL.targetP95Latency | 2,000 (ms) |
| CONCURRENCY_MODEL.queueDepthMultiplier | 1.5 |
| CONCURRENCY_MODEL.bandwidthUtilizationLimit | 0.90 |
| Default model overhead (%) | 15 |
| GPU VRAM usable fraction | 0.90 (90%) |

---

## 2. Model Memory

**Source code (line ~1339–1341):**

```javascript
const effParams = arch === 'moe' ? activeB : paramsB;
const modelMemGB = effParams * (quantBpw / 8);
const modelWithOverhead = modelMemGB * (1 + overhead);
```

**Formula:**

```
effectiveParams = (architecture == 'moe') ? activeParams : totalParams
modelMemGB      = effectiveParams × (quantBpw / 8)
modelWithOverhead = modelMemGB × (1 + overheadPct/100)
```

- `effectiveParams` — For MoE models, only the **active** parameters consume
  VRAM during inference (the expert routing means not all experts are loaded
  per token). For dense models, all parameters count.
- `quantBpw` — bits per weight from the quantization table (§1.2).
- `overheadPct` — user-specified model overhead percentage (default 15%).
  This covers CUDA kernels, activation buffers, and framework overhead.

**Output card:** "Model Memory (GB)" = `modelWithOverhead` (rounded to 1 dp).

**Units:** Billions of parameters × bits/weight / 8 = gigabytes (assuming 1 byte
= 8 bits, 1B params = 1×10⁹ params).

**Example:** DeepSeek V3 (37B active, MoE) at Q4_K_M (4.5 bpw):
  `37.0 × (4.5 / 8) = 20.81 GB` → with 15% overhead: `20.81 × 1.15 = 23.93 GB`.

---

## 3. KV Cache

**Source code (line ~1343–1346):**

```javascript
const kvPerTokenBytes = 2 * nLayers * nKvHeads * headDim * (kvBpw / 8);
const kvCacheGB = (kvPerTokenBytes * ctxLen * batchSize) / 1e9;
const kvEngineOverhead = kvCacheGB * effectiveKvWaste;
```

**Formula:**

```
kvPerTokenBytes = 2 × nLayers × nKvHeads × headDim × (kvBpw / 8)
kvCacheGB       = (kvPerTokenBytes × contextLength × batchSize) / 1,000,000,000
kvWithEngine    = kvCacheGB × effectiveKvWaste
```

- The factor of **2** accounts for K (key) and V (value) tensors.
- `nKvHeads` — number of KV attention heads (after GQA/MLA grouping).
- `headDim` — dimension of each attention head.
- `kvBpw` — KV cache precision: 16 (FP16), 8 (FP8), or 4 (FP4).
- `effectiveKvWaste` — engine-dependent multiplier (see §15.1):
  - raw: 1.30, vLLM: 1.15 (or 1.08 with block size 32), sglang: 1.10, tgi: 1.20.
  - This accounts for memory fragmentation and paged-attention block waste.

**Output card:** "KV Cache (GB)" = `kvWithEngine` (rounded to 2 dp).

**Units:** Bytes per token × tokens per batch × batch size, divided by 10⁹.

**Example:** DeepSeek V3 (61 layers, 1 KV head, 576 head dim, FP16 KV):
  `kvPerTokenBytes = 2 × 61 × 1 × 576 × 2 = 140,544 bytes/token`
  At context 32,768 and batch 8:
  `kvCacheGB = 140,544 × 32,768 × 8 / 1e9 = 36.84 GB`
  With vLLM 15% waste: `36.84 × 1.15 = 42.37 GB`.

---

## 4. GPU Fit

### 4.1 Per-GPU Memory

**Source code (line ~1348–1356):**

```javascript
const tensorMemGB = paramsB * (quantBpw / 8);
const modelPerGpuGB = tensorMemGB / (tp * pp);
const kvPerGpuGB = servingMode === 'disaggregated' ? kvEngineOverhead : kvEngineOverhead / tp;
const prefixCachePerGpuGB = servingEngine === 'sglang'
    ? sglangPrefixCacheSize / (servingMode === 'disaggregated' ? 1 : tp) : 0;
const totalPerGpuGB = modelPerGpuGB * (1 + overhead) + kvPerGpuGB + prefixCachePerGpuGB;
```

**Formula:**

```
tensorMemGB       = totalParams × (quantBpw / 8)        // full model, all params
modelPerGpuGB     = tensorMemGB / (TP × PP)             // sharded model weight per GPU
kvPerGpuGB        = (servingMode == 'disaggregated') ? kvWithEngine : kvWithEngine / TP
prefixCachePerGpu = (engine == 'sglang') ? prefixCacheSize / TP : 0    // disaggregated: /1
totalPerGpuGB     = modelPerGpuGB × (1 + overheadPct/100) + kvPerGpuGB + prefixCachePerGpu
```

**Key distinction — `tensorMemGB` vs `modelMemGB`:**
- `tensorMemGB` uses **totalParams** (all 671B for DeepSeek V3) because tensor
  parallelism shards the full model weight matrix across GPUs.
- `modelMemGB` (§2) uses **effectiveParams** (37B active) because only active
  params need to reside in VRAM for the compute path. The per-GPU sharding uses
  the full parameter count since all expert weights must be distributed across
  the TP group.

**Output card:** "VRAM / GPU (GB)" = `totalPerGpuGB` (rounded to 1 dp).

### 4.2 GPU Utilization

**Source code (line ~1417–1418):**

```javascript
let gpuUtil = (totalPerGpuGB / gpu.vram) * 100;
let utilClass = gpuUtil < 80 ? 'ok' : gpuUtil > 95 ? 'bad' : 'warn';
```

**Formula:**

```
gpuUtil = totalPerGpuGB / gpu.vram × 100
```

- `< 80%` → green (ok), `80–95%` → amber (warn), `> 95%` → red (bad).

**Output card:** "GPU Utilization %" = `gpuUtil` (rounded to 1 dp).

---

## 5. GPU Count & Sweet-Spot Analysis

### 5.1 GPUs Needed

**Source code (line ~1357–1358):**

```javascript
const gpusNeeded = Math.ceil(totalPerGpuGB / (gpu.vram * 0.90));
const serversNeeded = Math.ceil(gpusNeeded / gpusPerServer);
```

**Formula:**

```
gpusNeeded    = ⌈ totalPerGpuGB / (gpu.vram × 0.90) ⌉
serversNeeded = ⌈ gpusNeeded / gpusPerServer ⌉
```

- The **0.90** factor reserves 10% of VRAM as headroom (fragmentation, CUDA
  context, workspace).
- Since `totalPerGpuGB` already accounts for TP/PP sharding (§4.1),
  `gpusNeeded` represents the number of GPUs required per parallelism group. The
  minimum physical cluster to serve the model is `max(gpusNeeded, TP × PP)`
  GPUs (the tool does not explicitly enforce this — it reports `gpusNeeded`
  directly).

**Output cards:** "GPUs Needed" = `gpusNeeded` (integer). "Servers Needed" =
`serversNeeded` (integer).

### 5.2 Total Cluster VRAM

**Source code (line ~1420):**

```javascript
const totalClusterVram = totalGpus * gpu.vram;
```

where `totalGpus = gpusPerServer × numServers`.

**Output card:** "Total Cluster VRAM (GB)" = `totalClusterVram` (integer).

### 5.3 Sweet Spot

**Source code (line ~1537–1544):**

```javascript
if (gpusNeeded <= totalGpus) {
    const spare = totalGpus - gpusNeeded;
    if (spare === 0) sweetSpot = 'Tight fit — no headroom';
    else sweetSpot = `Oversized: ${spare} spare GPU(s) — increase batch or context`;
} else {
    sweetSpot = `Under-provisioned: need +${gpusNeeded - totalGpus} more GPU(s)`;
}
```

**Output card:** "Sweet Spot" — one of:
- **"Tight fit — no headroom"** — exactly enough GPUs.
- **"Oversized: N spare GPU(s)"** — more GPUs configured than needed.
- **"Under-provisioned: need +N more GPU(s)"** — not enough GPUs.

---

## 6. System RAM & NVMe Cache

**Source code (line ~1421–1422):**

```javascript
const sysRamGB = modelMemGB * 2;
const nvmeGB = modelMemGB * 3;
```

**Formula:**

```
systemRAM = modelMemGB × 2     // 2× effective model size (for CPU offload buffers)
nvmeCache = modelMemGB × 3     // 3× effective model size (for model storage)
```

**Output cards:** "System RAM (GB)" and "NVMe Cache (GB)" — both integers.

---

## 7. Decode Throughput

### 7.1 Raw Memory-Bandwidth-Bound Throughput

**Source code (line ~1425):**

```javascript
const memBwTokensPerSec = gpu.bw * 1e9 / (effParams * 1e9 * (quantBpw / 8) / tp);
```

**Formula:**

```
rawDecodeTps = gpu.bw × 1e9 / (effectiveParams × 1e9 × (quantBpw / 8) / TP)
             = gpu.bw / (effectiveParams × (quantBpw / 8) / TP)
```

- `gpu.bw` — memory bandwidth in GB/s (e.g. 3,350 for H100).
- Decode is **memory-bandwidth bound**: each generated token requires reading
  the full active model weights from VRAM once.
- TP divides the per-token weight read across TP GPUs.

### 7.2 Effective Decode Throughput

**Source code (line ~1429–1433):**

```javascript
let effectiveDecodeThroughput = memBwTokensPerSec / effectiveBatchEff;
if (servingEngine === 'tgi') {
    effectiveDecodeThroughput *= tgiBatchingMultiplier;
}
```

**Formula:**

```
effectiveDecodeTps = rawDecodeTps / effectiveBatchEff
                   [× tgiBatchingMultiplier if engine is TGI]
```

- `effectiveBatchEff` — engine batch efficiency (see §15.2). Lower values
  produce higher throughput (continuous batching increases efficiency).
- For vLLM, `effectiveBatchEff` is dynamically adjusted based on vLLM
  scheduling limits (§15.2).

**Output card:** "Decode Throughput tok/s (CE-013)" = `effectiveDecodeThroughput`
(also "Eff. Throughput tok/s (CE-007)").

---

## 8. Tokens per Dollar

**Source code (line ~1455):**

```javascript
const tokensPerDollar = (effectiveDecodeThroughput * 3600) / gpu.price_hour;
```

**Formula:**

```
tokensPerDollar = effectiveDecodeTps × 3,600 / gpu.price_hour
```

- Produces tokens generated per $1 of GPU rental cost at 100% utilization.
- `gpu.price_hour` is from GPU_SPECS (the intrinsic spec price), NOT the
  cloud-provider price (which is used for cluster cost, §10).

**Output card:** "Est. tok/$ (decode)" — formatted as K/M.

---

## 9. Cost per 1M Tokens (CE-005)

### 9.1 Input Cost (prefill-bound)

**Source code (line ~1481–1483):**

```javascript
const costPer1MInput = prefillTokensPerSec > 0
    ? ((1_000_000 / prefillTokensPerSec / 3600) * cloudPricePerGpu * gpusNeeded) : 0;
```

**Formula:**

```
costInputPer1M = (1,000,000 / effectivePrefillTps / 3,600) × cloudPricePerGpu × gpusNeeded
```

- Time to process 1M tokens = `1M / prefillTps / 3600` hours.
- Multiplied by hourly cost × GPU count.

### 9.2 Output Cost (decode-bound)

**Source code (line ~1485–1487):**

```javascript
const costPer1MOutput = effectiveDecodeThroughput > 0
    ? ((1_000_000 / effectiveDecodeThroughput / 3600) * cloudPricePerGpu * gpusNeeded) : 0;
```

**Formula:**

```
costOutputPer1M = (1,000,000 / effectiveDecodeTps / 3,600) × cloudPricePerGpu × gpusNeeded
```

**Output cards:** "Input Cost $/1M tok (CE-005)" and "Output Cost $/1M tok
(CE-005)".

---

## 10. Cluster Cost per Hour

**Source code (line ~1463–1468):**

```javascript
const cloudPricePerGpu = (gpuKey && CLOUD_PRICING[provider] && ...)
    ? CLOUD_PRICING[provider].gpus[gpuKey] : gpu.price_hour;
const clusterCostPerHour = cloudPricePerGpu * gpusNeeded;
```

**Formula:**

```
cloudPricePerGpu = CLOUD_PRICING[provider].gpus[gpuKey]  (or gpu.price_hour fallback)
clusterCostPerHour = cloudPricePerGpu × gpusNeeded
```

**Output cards:** "Est. Cost/hr" and the "Cluster Cost Estimate" field.

---

## 11. Prefill Throughput (CE-013)

### 11.1 Compute-Bound Prefill Throughput

**Source code (line ~1472–1476):**

```javascript
const gpuTflops = (gpu.tflops_bf16 || 990);
const computePrefillTps = (gpuTflops * 1e12) / (2 * effParams * 1e9 * (quantBpw / 8) / tp)
                          * prefillComputeEff;
const effectivePrefillTps = computePrefillTps * engineCfg.prefillEff;
```

**Formula:**

```
rawPrefillTps      = gpuTflops × 1e12 / (2 × effParams × 1e9 × (quantBpw / 8) / TP)
                           × prefillComputeEff
effectivePrefillTps = rawPrefillTps × engineCfg.prefillEff
```

- Prefill is **compute-bound** (as opposed to decode which is memory-bound).
- **2 FLOP per parameter per token** (1 multiply + 1 accumulate in the GEMM).
- `gpuTflops` — BF16/FP16 tensor compute (from GPU_SPECS).
- `prefillComputeEff` — user-adjustable compute efficiency (default 0.50 = 50%
  of peak TFLOPS).
- `engineCfg.prefillEff` — engine-specific prefill efficiency multiplier:
  raw=1.0, vLLM=0.85, sglang=0.80, tgi=0.90.

**Output card:** "Prefill Throughput tok/s (CE-013)" = `effectivePrefillTps`.

---

## 12. Prefill Latency & TTFT

### 12.1 Prefill Latency

**Source code (line ~1570):**

```javascript
const prefillLatencyMs = effectivePrefillTps > 0
    ? (promptLen * prefillBatchSize / effectivePrefillTps * 1000) : 0;
```

**Formula:**

```
prefillLatencyMs = promptLen × prefillBatchSize / effectivePrefillTps × 1000
```

**Output card:** "Prefill Latency ms (CE-013)".

### 12.2 Time-to-First-Token (TTFT)

**Source code (line ~1577–1586):**

```javascript
const rTTFT = effectivePrefillTps > 0 ? (promptLen / effectivePrefillTps) * 1000 : 0;
const batchQueuingFactor = 1 + (prefillBatchSize - 1) * 0.15;
const rTTFTBatched = rTTFT * batchQueuingFactor;
const modelLoadTimeMs = modelWithOverhead * 200;
const rTtftReady = rTTFTBatched + modelLoadTimeMs;
```

**Formulas:**

```
TTFT_ms           = promptLen / effectivePrefillTps × 1000
batchQueuingFactor = 1 + (prefillBatchSize - 1) × 0.15
TTFTBatched_ms    = TTFT_ms × batchQueuingFactor
modelLoadTime_ms  = modelWithOverhead × 200       // ~200ms per GB at ~5 GB/s NVMe
readyToServe_ms   = TTFTBatched_ms + modelLoadTime_ms
```

- `batchQueuingFactor` models queuing delay from concurrent prefill requests:
  each additional concurrent request adds 15% to TTFT.
- `modelLoadTime` estimates cold-start: ~200 ms per GB of model weights (assumes
  ~5 GB/s NVMe read speed).

**Output cards:** "TTFT ms (CE-014)", "TTFT Batched ms (CE-014)",
"Ready-to-Serve ms (CE-014)".

---

## 13. Speculative Decoding (CE-015)

**Source code (line ~1594–1601):**

```javascript
if (enableSpec) {
    const boostFactor = (1 + specAcceptRate * specDraftTokens) / (1 + specDraftOverhead);
    specDecodeThroughput = effectiveDecodeThroughput * boostFactor;
    specSpeedup = boostFactor;
    draftModelMemGB = modelWithOverhead * specDraftRatio;
}
```

**Formulas:**

```
boostFactor       = (1 + acceptanceRate × draftTokensPerStep) / (1 + draftOverhead)
specDecodeThroughput = effectiveDecodeTps × boostFactor
specSpeedup       = boostFactor
draftModelMemGB   = modelWithOverhead × draftRatio
```

- A draft model proposes `k` tokens per step; the target model verifies them in
  a single forward pass. With acceptance rate `α`, the expected tokens per step
  is `1 + α × k` (1 verified + α × k accepted draft tokens).
- The `draftOverhead` penalizes for the extra compute of the draft model.
- `draftRatio` — draft model size as a fraction of the target (default 10%).

**Defaults** (from SPECULATIVE_DECODING): k=3, α=0.80, ratio=0.10, overhead=0.15.
With defaults: `boost = (1 + 0.80 × 3) / (1 + 0.15) = 3.4 / 1.15 = 2.957×`.

**Output cards:** "Spec. Decode Tput tok/s", "Speedup vs Baseline", "Draft
Model Mem GB", "Acceptance Rate".

---

## 14. Concurrent Users (CE-016)

**Source code (line ~1618–1626):**

```javascript
const outputTokensPerReq = 256;
const effectiveReqPerSec = effectiveDecodeThroughput > 0
    ? effectiveDecodeThroughput / outputTokensPerReq : 0;
const latencyWithQueue = targetP50Latency * (1 + (maxConcurrentUsers - 1)
    * queueDepthMultiplier * 0.01);
const satReached = maxConcurrentUsers > 0 && effectiveReqPerSec > 0
    ? (maxConcurrentUsers / effectiveReqPerSec) > bandwidthUtilizationLimit : false;
const effectiveQueueDepth = maxConcurrentUsers > 0
    ? queueDepthMultiplier * maxConcurrentUsers : 0;
```

**Formulas:**

```
outputTokensPerReq  = 256                              // hardcoded assumption
reqPerSec           = effectiveDecodeTps / 256
latencyAtMaxLoad    = targetP50Latency × (1 + (maxConcurrentUsers - 1) × queueDepthMultiplier × 0.01)
latencyP95          = latencyAtMaxLoad × 2             // P95 ≈ 2 × P50
bandwidthSaturated  = (maxConcurrentUsers / reqPerSec) > bandwidthUtilizationLimit
effectiveQueueDepth = queueDepthMultiplier × maxConcurrentUsers
```

- **Saturation check:** if the number of concurrent users divided by the
  achievable requests/sec exceeds the bandwidth utilization limit (default 90%),
  the system is saturated.
- **Latency scaling:** each additional user adds `queueDepthMultiplier × 0.01`
  (default 1.5%) to the base P50 latency.

**Output cards:** "Max Concurrent Users", "Requests/sec @ P50", "Latency @ Max
Load", "Bandwidth Saturated?", "Effective Queue Depth".

---

## 15. Serving Engine Overhead (CE-007)

### 15.1 Effective KV Waste

**Source code (line ~1248–1251):**

```javascript
let effectiveKvWaste = engineCfg.kvWaste;
if (servingEngine === 'vllm') {
    effectiveKvWaste = vllmBlockSize === 32 ? 1.08 : 1.15;
}
```

For vLLM, larger block size (32) reduces fragmentation waste to 8% vs 15%.

**Output card:** "KV Waste %" — if `effectiveKvWaste == rawKvWaste` (1.30),
displays "0% (baseline)"; otherwise displays `(effectiveKvWaste × 100 - 100)%`
as savings relative to raw. Wait — actually the displayed value is
`(effectiveKvWaste * 100).toFixed(1) + '%'`, showing the absolute waste
percentage above 100% (e.g. vLLM shows "115.0%").

**Correction:** The code is `effectiveKvWaste === rawKvWaste ? '0% (baseline)' :
(effectiveKvWaste * 100).toFixed(1) + '%'`. So for vLLM it shows "115.0%",
meaning the KV cache occupies 115% of its theoretical size (15% waste).

### 15.2 Effective Batch Efficiency

**Source code (line ~1254–1262):**

```javascript
let effectiveBatchEff = engineCfg.batchEff;
if (servingEngine === 'vllm') {
    const avgTokensPerReq = ctxLen * 0.3;
    const totalBatchedTokens = batchSize * avgTokensPerReq;
    const tokenHeadroom = Math.min(1, totalBatchedTokens / vllmMaxNumBatchedTokens);
    const seqHeadroom = Math.min(1, batchSize / vllmMaxNumSeqs);
    const constraintFactor = (tokenHeadroom + seqHeadroom) / 2;
    effectiveBatchEff = 1.0 - (1.0 - engineCfg.batchEff) * constraintFactor;
}
```

**Formula (vLLM only):**

```
avgTokensPerReq   = ctxLen × 0.3
totalBatchedTokens = batchSize × avgTokensPerReq
tokenHeadroom     = min(1, totalBatchedTokens / vllmMaxNumBatchedTokens)
seqHeadroom       = min(1, batchSize / vllmMaxNumSeqs)
constraintFactor  = (tokenHeadroom + seqHeadroom) / 2
effectiveBatchEff = 1.0 - (1.0 - engineCfg.batchEff) × constraintFactor
```

- When batch/token constraints are loosely binding (headroom → 1),
  `effectiveBatchEff` approaches `engineCfg.batchEff` (0.70 for vLLM).
- When constraints are tightly binding (headroom → 0),
  `effectiveBatchEff` approaches 1.0 (no batching penalty).

**Output card:** "Batch Efficiency (CE-007)" = `(1.0 / effectiveBatchEff) × 100`
as a percentage. This represents how many times faster the effective throughput
is compared to single-request serving.

### 15.3 KV Waste Savings

```
kvWasteSavingsPct = ((rawKvWaste - effectiveKvWaste) / rawKvWaste) × 100
```

Where `rawKvWaste = SERVING_OVERHEAD['raw'].kvWaste = 1.30`.

---

## 16. SGLang RadixAttention (CE-008)

**Source code (line ~1439–1444):**

```javascript
if (servingEngine === 'sglang') {
    const hitBoost = 1.5;
    const missPenalty = 1.0 - sglangRadixTreeOverhead;
    radixMultiplier = sglangCacheHitRate * hitBoost + (1.0 - sglangCacheHitRate) * missPenalty;
    effectiveRadixThroughput = effectiveDecodeThroughput * radixMultiplier;
}
```

**Formula:**

```
hitBoost       = 1.5                               // 50% throughput boost on cache hit
missPenalty    = 1.0 - sglangRadixTreeOverhead     // default: 1.0 - 0.05 = 0.95
radixMultiplier = cacheHitRate × hitBoost + (1 - cacheHitRate) × missPenalty
radixThroughput = effectiveDecodeTps × radixMultiplier
```

**Prefix cache VRAM competition (line ~1353–1355):**

```
prefixCachePerGpu = prefixCacheSize / TP   (monolithic mode)
prefixCachePerGpu = prefixCacheSize / 1     (disaggregated mode)
```

This VRAM is added to `totalPerGpuGB`, competing with the KV cache.

**Output cards:** "SGLang Radix Tput tok/s (CE-008)" and "Cache Hit/Miss Ratio
(CE-008)" — only populated when engine is SGLang.

---

## 17. TGI Continuous Batching (CE-009)

**Source code (line ~1267–1279):**

```javascript
if (servingEngine === 'tgi') {
    const batchRatio = Math.min(1.0, batchSize / tgiMaxBatchSize);
    const avgTokensPerReqTgi = ctxLen * 0.3;
    const totalTokensInFlight = batchSize * avgTokensPerReqTgi;
    const tokenBudgetRatio = Math.min(1.0, totalTokensInFlight / tgiMaxTotalTokens);
    const combinedConstraint = Math.min(batchRatio, tokenBudgetRatio);
    tgiBatchingMultiplier = combinedConstraint * engineCfg.batchEff;
    tgiQueueDepth = tgiMaxWaitingSeqs / tgiMaxBatchSize;
}
```

**Formulas:**

```
batchRatio       = min(1, batchSize / tgiMaxBatchSize)
tokenBudgetRatio = min(1, (batchSize × ctxLen × 0.3) / tgiMaxTotalTokens)
combinedConstraint = min(batchRatio, tokenBudgetRatio)
tgiBatchingMultiplier = combinedConstraint × engineCfg.batchEff   (0.75 for TGI)
tgiQueueDepth    = tgiMaxWaitingSeqs / tgiMaxBatchSize
```

The `tgiBatchingMultiplier` is then applied as:
`effectiveDecodeThroughput *= tgiBatchingMultiplier` (line ~1432).

---

## 18. Expert Parallelism / MoE (CE-012)

Only computed when `arch === 'moe'`.

**Source code (line ~1391–1415):**

```javascript
const epAllToAllOverhead = (allToAllOverheadPct / 100) * (numExperts / epSize)
                           * (topK / numExperts);
const epLoadImbOverhead = loadBalancePenalty / 100;
const epCombinedOverhead = 1 + epAllToAllOverhead + epLoadImbOverhead;

epAdjustedGpus = Math.ceil(gpusNeeded * epCombinedOverhead);
epExpertsPerGpu = epSize > 1 ? Math.ceil(numExperts / epSize) : numExperts;
epEfficiency = epSize > 1 ? ((1 - epAllToAllOverhead - epLoadImbOverhead) * 100) : 100;
const epMemScale = epSize > 1 ? (epExpertsPerGpu / numExperts) : 1;
epMemAdjustment = modelWithOverhead * (1 - epMemScale);
```

**Formulas:**

```
allToAllOverhead = (allToAllOverheadPct / 100) × (numExperts / EP) × (topK / numExperts)
                 = (allToAllOverheadPct / 100) × topK / EP
loadImbOverhead  = loadBalancePenalty / 100
combinedOverhead = 1 + allToAllOverhead + loadImbOverhead

adjustedGpus      = ⌈ gpusNeeded × combinedOverhead ⌉
expertsPerGpu     = (EP > 1) ? ⌈ numExperts / EP ⌉ : numExperts
epEfficiency      = (EP > 1) ? (1 - allToAllOverhead - loadImbOverhead) × 100 : 100
memScale          = (EP > 1) ? expertsPerGpu / numExperts : 1
memAdjustment     = modelWithOverhead × (1 - memScale)
```

- `allToAllOverhead` simplifies to `(overheadPct/100) × topK / EP` because the
  `numExperts` terms cancel.
- `memAdjustment` represents VRAM savings from expert sharding: fewer experts
  per GPU means less per-GPU model memory.

**Defaults** (from MOE_EXPERT_CONFIG): numExperts=8, topK=2, EP=1,
allToAllOverheadPct=5, loadBalancePenalty=10.

**Output cards:** "EP All-to-All Eff %", "MoE-Adjusted GPUs", "Experts per GPU",
"MoE Mem Adjustment GB" — all show "N/A (dense)" for non-MoE models.

---

## 19. NVLink Topology (CE-010)

### 19.1 Bandwidth Ratio

**Source code (line ~1363):**

```javascript
const bwRatio = nvlinkInterNodeBw > 0 ? nvlinkIntraNodeBw / nvlinkInterNodeBw : 1;
```

```
bwRatio = (intraNodeBw > 0 && interNodeBw > 0) ? intraNodeBw / interNodeBw : 1
```

### 19.2 Cross-Node Penalty

**Source code (line ~1416–1436, main pane):**

```javascript
const tpFitsNode = tp <= gpusPerServer; // IE-GAP-031: TP fits one node iff TP ≤ per-node GPUs
const ppFitsNode = pp > 1 ? pp <= gpusPerServer : true;
const tpIsCrossNode = tpCrossNode === 'cross-node'
    || (tpCrossNode === 'auto' && !tpFitsNode && tp > gpusPerServer);
const ppIsCrossNode = ppCrossNode === 'cross-node'
    || (ppCrossNode === 'auto' && !ppFitsNode && pp > 1);
if (tpIsCrossNode || ppIsCrossNode) {
    const crossPenalty = 1.0 + Math.log10(Math.max(1, bwRatio)) * 0.15;
    nvlinkGpuPenalty = crossPenalty;
}
const nvlinkAdjustedGpus = Math.ceil(gpusNeeded * nvlinkGpuPenalty);
// IE-GAP-031: penalty is wired into a real headline metric — effective decode
// throughput is divided by the penalty whenever TP/PP span nodes:
if (tpIsCrossNode || ppIsCrossNode) {
    effectiveDecodeThroughput /= nvlinkGpuPenalty;
}
```

**Formula:**

```
tpFitsNode  = TP ≤ gpusPerServer
ppFitsNode  = PP ≤ gpusPerServer        (PP > 1)
tpCrossNode = (policy == 'cross-node') OR (policy == 'auto' AND !tpFitsNode AND TP > gpusPerServer)
ppCrossNode = (policy == 'cross-node') OR (policy == 'auto' AND !ppFitsNode AND PP > 1)

if (tpCrossNode OR ppCrossNode):
    nvlinkGpuPenalty = 1.0 + log10(max(1, bwRatio)) × 0.15
else:
    nvlinkGpuPenalty = 1.0

nvlinkAdjustedGpus = ⌈ gpusNeeded × nvlinkGpuPenalty ⌉

if (tpCrossNode OR ppCrossNode):
    effectiveDecodeThroughput = effectiveDecodeThroughput / nvlinkGpuPenalty
```

**IE-GAP-031 correction (2026-08-22):** `tpFitsNode` previously compared
`⌈ gpusNeeded / TP ⌉ ≤ gpusPerServer` — the VRAM-derived GPU *total*, which is
the wrong quantity. With TP=16, gpusPerServer=8 and gpusNeeded=16 (TP×PP floor)
the old check gave `1 ≤ 8` = "fits" even though the TP group physically spans
2 nodes, so auto mode never fired the penalty and topology changes had zero
effect on computed sizing. The check is now TP ≤ gpusPerServer. The penalty is
additionally wired into effective decode throughput (÷ penalty when
cross-node), so NVLink/NVSwitch/InfiniBand/PCIe choices now change real
headline outputs (Decode Throughput, Effective Throughput, req/s, $/1M output)
under cross-node policies, not just the "NVLink BW Utilization" readout.

### 19.3 NVLink Bandwidth Utilization

```javascript
const nvlinkBwUtilPct = (nvlinkIntraNodeBw / gpu.bw * 100);
```

```
nvlinkBwUtil = intraNodeBw / gpu.bw × 100
```

**Output cards:** "NVLink BW Utilization" (absolute GB/s + % of GPU BW),
"Cross-Node Penalty" (×multiplier or "None (intra-node)").

---

## 20. Multi-Node Scaling (CE-011)

Only applied when `numServers > 1`.

### 20.1 All-Reduce Penalty

**Source code (line ~1296–1306):**

```javascript
if (crossNodeTP) {
    const ce011EffParams = arch === 'moe' ? activeB : paramsB;
    const computeTimePerToken = (ce011EffParams * (quantBpw / 8) * 1e9) / (gpu.bw * 1e9 * tp);
    const commTimePerAllReduce = ncclAllReduceLatencyUs * 1e-6;
    const numAllReduces = nLayers * 2;
    const totalCommTime = commTimePerAllReduce * numAllReduces * (tp / tpGpusPerServer);
    const totalComputeTime = computeTimePerToken * ctxLen * batchSize;
    allReducePenalty = totalComputeTime > 0
        ? Math.min(totalCommTime / (totalCommTime + totalComputeTime), 0.5) : 0;
}
```

**Formula:**

```
computeTimePerToken = (effParams × quantBpw/8 × 1e9) / (gpu.bw × 1e9 × TP)
                     = effParams × quantBpw/8 / (gpu.bw × TP)
commTimePerAllReduce = ncclAllReduceLatencyUs × 1e-6   // seconds
numAllReduces = nLayers × 2                             // 2 per transformer layer
totalCommTime = commTimePerAllReduce × numAllReduces × (TP / tpGpusPerServer)
totalComputeTime = computeTimePerToken × ctxLen × batchSize
allReducePenalty = min(totalCommTime / (totalCommTime + totalComputeTime), 0.5)
```

- Capped at 50% penalty maximum.
- `tpGpusPerServer = min(TP, gpusPerServer)` — GPUs per server participating in
  each TP group.

### 20.2 Pipeline Bubble Penalty

**Source code (line ~1309–1314):**

```javascript
if (crossNodePP) {
    pipelineBubblePenalty = ((pp - 1) / (pp * 2)) * pipelineBubblePct;
} else if (pp > 1) {
    pipelineBubblePenalty = ((pp - 1) / (pp * 2)) * (pipelineBubblePct * 0.3);
}
```

**Formula:**

```
if crossNodePP:
    pipelineBubblePenalty = (PP - 1) / (PP × 2) × pipelineBubblePct
elif PP > 1:
    pipelineBubblePenalty = (PP - 1) / (PP × 2) × pipelineBubblePct × 0.3
```

- Intra-node pipeline parallelism incurs only 30% of the cross-node bubble
  overhead (NVLink helps).

### 20.3 Combined Scaling Efficiency

**Source code (line ~1317–1336):**

```javascript
const commEfficiency = (1 - allReducePenalty) * (1 - pipelineBubblePenalty);

if (scalingModel === 'empirical') {
    // Lookup table by numServers
    scalingEfficiency = curveVal * commEfficiency;
} else if (scalingModel === 'nccl-aware') {
    const bwRatio = ncclBwUtil;  // GPU BW utilization factor
    scalingEfficiency = bwRatio * commEfficiency;
} else { // ideal
    scalingEfficiency = commEfficiency;
}
```

**Formula:**

```
commEfficiency = (1 - allReducePenalty) × (1 - pipelineBubblePenalty)

empirical: scalingEfficiency = curveLookup(numServers) × commEfficiency
nccl-aware: scalingEfficiency = ncclBwUtil × commEfficiency
ideal:      scalingEfficiency = commEfficiency
```

**Empirical curve** (numServers → efficiency): 1→1.0, 2→0.95, 4→0.88, 8→0.78,
16→0.65, 32→0.50, 64→0.35, 128→0.22.

### 20.4 Throughput with Scaling

```javascript
const throughputWithScaling = numServers > 1
    ? (effectiveDecodeThroughput * scalingEfficiency) : effectiveDecodeThroughput;
```

```
effTputWithScaling = (numServers > 1) ? effectiveDecodeTps × scalingEfficiency
                                       : effectiveDecodeTps
```

**Output cards:** "Scaling Efficiency %", "Multi-Node Penalty" (=
`(1 - scalingEfficiency) × 100`), "Eff. Tput w/ Scaling tok/s".

---

## 21. Cloud Provider Pricing Table

**Source constant: CLOUD_PRICING**

| Provider | H100-80 | H200-141 | B200-192 | A100-80 | A100-40 |
|----------|---------|----------|----------|---------|---------|
| Lambda Labs | $2.49 | $3.29 | $3.99 | $1.89 | $1.29 |
| RunPod | $2.49 | $3.49 | — | $1.89 | $1.29 |
| Vast.ai | $2.40 | — | — | $1.55 | $1.00 |
| CoreWeave | $2.21 | — | — | $1.67 | — |

(— = not listed / null)

Prices are per GPU per hour. If the selected GPU is not listed for the selected
provider, the GPU_SPECS intrinsic price is used as fallback.

---

## 22. API Pricing & Breakeven

### 22.1 API Pricing

Per-model, per-provider pricing is stored in `API_PRICING` (loaded from
`models/*.json` `pricing` fields at runtime, or `FALLBACK_API_PRICING` as
fallback). Values are USD per 1 million tokens (input/output).

**Output:** Shown in the API Pricing card model list and the comparison table.

### 22.2 Self-Hosted vs API Comparison Table

| Row | Self-Hosted | API |
|-----|------------|-----|
| Input ($/1M tok) | `costPer1MInput` (§9.1) | `API_PRICING[provider][model].input` |
| Output ($/1M tok) | `costPer1MOutput` (§9.2) | `API_PRICING[provider][model].output` |
| Breakeven (tok/mo) | — | `breakevenTokensPerMonth` |

### 22.3 Breakeven Calculation

**Source code (line ~1491–1501):**

```javascript
const monthlyGpuCost = cloudPricePerGpu * gpusNeeded * 730 * 2;
breakevenTokensPerMonth = monthlyGpuCost / (apiOutputCost / 1_000_000);
```

**Formula:**

```
monthlyGpuCost = cloudPricePerGpu × gpusNeeded × 730 × 2
               = cloudPricePerGpu × gpusNeeded × 1,460

breakevenTokensPerMonth = monthlyGpuCost / (apiOutputCostPer1M / 1,000,000)
                        = monthlyGpuCost × 1,000,000 / apiOutputCostPer1M
```

- **730 hours/month** — standard cloud billing assumption.
- **× 2 multiplier** — assumes 50% utilization (the other 50% is idle time).
- **Breakeven** = monthly GPU cost at 50% utilization divided by the API's
  per-million-token output price. If your monthly output token volume exceeds
  this, self-hosting is cheaper than the API.

**Output cards:** "Breakeven tok/mo (CE-006)" — formatted as B/M/raw number.

---

*All formulas above are derived from `cluster-estimator.html` recalculate()
function. For a worked example with real numbers, see [QUICKSTART.md](QUICKSTART.md).
For input field definitions, see [GLOSSARY.md](GLOSSARY.md).*
