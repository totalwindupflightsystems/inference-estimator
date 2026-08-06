# Inference Cluster Estimator — Input & Output Glossary

This glossary documents every input control (by `id=` attribute) and every
output metric in the tool, with label, meaning, units, allowed range, and what
each feeds into. Output metrics are cross-referenced to their formula section in
[FORMULAS.md](FORMULAS.md).

---

## Part 1: Input Controls

### Model Card

| ID | Label | Meaning | Units | Range/Options | Feeds Into |
|----|-------|---------|-------|---------------|------------|
| `presetFilter` | Filter by architecture | Filters the preset dropdown by model architecture | — | `all`, `dense`, `moe` | Preset list filtering |
| `modelPreset` | Preset | Model preset selector | — | Any model from `models/index.json` | Auto-fills params, arch, activeParams, nLayers, nKvHeads, headDim, hiddenSize |
| `params` | Number of Parameters (billions) | Total parameter count of the model | Billions | 0.1–1000, step 0.1 | Model memory (tensorMemGB), MoE total/active note |
| `arch` | Architecture | Dense or Mixture of Experts | — | `dense`, `moe` | Effective params selection, expert card visibility |
| `activeParams` | Active Parameters (B) — for MoE | Parameters active per forward pass (MoE only) | Billions | 0.1–1000, step 0.1 | Model memory (effParams), decode throughput, prefill throughput, scaling penalty |
| `nLayers` | Number of Layers | Transformer decoder layers | Integer | 1–200 | KV cache size, all-reduce penalty (nLayers × 2) |
| `nKvHeads` | KV Heads | Number of key-value attention heads (after GQA/MLA) | Integer | 1–128 | KV cache size |
| `headDim` | Head Dim | Dimension of each attention head | Integer | 32–256 | KV cache size |
| `hiddenSize` | Hidden Size | Model hidden dimension | Integer | 256–65536, step 256 | Not used in current calculations (informational) |

### Quantization & Context Card

| ID | Label | Meaning | Units | Range/Options | Feeds Into |
|----|-------|---------|-------|---------------|------------|
| `quant` | Quantization | Weight quantization level (bits per weight) | bpw | `2.0` (IQ2_XXS), `2.5` (IQ3_XXS), `4.0` (Q4_0), `4.5` (Q4_K_M), `5.0` (Q5_K_M), `6.0` (Q6_K), `8.0` (Q8_0), `16.0` (FP16), `32.0` (FP32) | Model memory, tensor memory, decode throughput, prefill throughput, all-reduce penalty |
| `kvPrecision` | KV Cache Precision | Precision of stored KV cache | bits | `16` (FP16), `8` (FP8), `4` (FP4) | KV cache size (kvBpw) |
| `context` | Context Length (tokens) | Maximum sequence length per request | Tokens | 1,024–1,048,576, step 1,024 | KV cache size, prefill latency, batch efficiency, TGI token budget |
| `batchSize` | Batch Size (requests) | Number of concurrent sequences being decoded | Requests | 1–1024 | KV cache size, batch efficiency, TGI batching, concurrency model |
| `overhead` | Model Overhead (%) | Extra VRAM for CUDA kernels, activation buffers, framework | Percent | 0–50 | Model memory (modelWithOverhead), per-GPU memory, draft model memory |

### GPU Configuration Card

| ID | Label | Meaning | Units | Range/Options | Feeds Into |
|----|-------|---------|-------|---------------|------------|
| `gpuModel` | GPU Model | GPU hardware selection | — | `H100-80`, `H200-141`, `B200-192`, `A100-80`, `A100-40`, `L40S-48`, `MI300X-192`, `RTX6000-48`, `custom` | VRAM, bandwidth, price, TFLOPS — feeds all throughput/cost formulas |
| `customVram` | Custom VRAM (GB) | User-defined VRAM (only visible when GPU = custom) | GB | 1+, step 1 | GPU VRAM in fit calculations |
| `gpuPerServer` | GPUs per Server | Number of GPUs per node | Integer | 1–16 | Total cluster VRAM, servers needed, cross-node TP/PP detection |
| `numServers` | Number of Servers | Number of nodes in the cluster | Integer | 1–128 | Total cluster VRAM, multi-node scaling, total GPU count |
| `servingMode` | Serving Mode | Prefill/decode colocation strategy | — | `monolithic` (same GPU), `disaggregated` (separate) | KV per-GPU distribution (÷TP or full) |
| `tpSize` | Tensor Parallel Size | Number of GPUs for tensor parallelism (model shard) | Integer | 1–8 | Model per-GPU, KV per-GPU, decode throughput, prefill throughput, cross-node detection |
| `ppSize` | Pipeline Parallel Size | Number of pipeline stages | Integer | 1–8 | Model per-GPU, pipeline bubble penalty, cross-node detection |

### Expert Placement Card (CE-012) — visible only when arch = MoE

| ID | Label | Meaning | Units | Range/Options | Feeds Into |
|----|-------|---------|-------|---------------|------------|
| `numExperts` | Total Experts | Number of expert networks in the MoE layer | Integer | 2–256 | EP all-to-all overhead, experts per GPU, MoE memory adjustment |
| `topK` | Top-K Active | Number of experts activated per token | Integer | 1–16 | EP all-to-all overhead (simplifies to topK/EP factor) |
| `epSize` | Expert Parallel Size (EP) | Number of GPU groups for expert distribution | — | `1`, `2`, `4`, `8` | Experts per GPU, EP efficiency, EP overhead, memory adjustment |
| `allToAllOverhead` | All-to-All Overhead (%) | Bandwidth overhead for expert dispatch | Percent | 0–50 | EP all-to-all overhead, EP efficiency |
| `loadBalancePenalty` | Load Imbalance Penalty | Penalty for uneven expert routing | Percent | 0–30 | EP load imbalance overhead, EP efficiency |

### Topology Card (CE-010)

| ID | Label | Meaning | Units | Range/Options | Feeds Into |
|----|-------|---------|-------|---------------|------------|
| `nvlinkTopo` | NVLink / Interconnect Topology | Interconnect technology preset | — | `nvlink-900` (NVLink 4.0), `nvlink-1800` (NVSwitch), `pcie-5` (PCIe 5.0), `infiniband` (IB NDR400) | Auto-sets intra/inter node bandwidth sliders |
| `nvlinkIntraNodeBw` | Within-Node Bandwidth (GB/s) | GPU-to-GPU bandwidth within a server | GB/s | 0–2000, step 25 | Bandwidth ratio, NVLink BW utilization %, cross-node penalty |
| `nvlinkInterNodeBw` | Cross-Node Bandwidth (GB/s) | Node-to-node bandwidth (NIC speed) | GB/s | 0–500, step 5 | Bandwidth ratio, cross-node penalty calculation |
| `tpCrossNode` | TP Cross-Node Policy | Whether tensor parallelism can span nodes | — | `auto`, `same-node`, `cross-node` | Cross-node penalty detection |
| `ppCrossNode` | PP Cross-Node Policy | Whether pipeline parallelism can span nodes | — | `auto`, `same-node`, `cross-node` | Pipeline bubble penalty detection |

### Multi-Node Scaling Card (CE-011)

| ID | Label | Meaning | Units | Range/Options | Feeds Into |
|----|-------|---------|-------|---------------|------------|
| `scalingModel` | Scaling Model | Efficiency model for multi-node scaling | — | `ideal` (linear), `nccl-aware` (bandwidth-based), `empirical` (curve lookup) | Scaling efficiency calculation |
| `ncclAllReduceLatencyUs` | NCCL All-Reduce Latency (μs) | Per-call latency for NCCL all-reduce | Microseconds | 1–1000, step 1 | All-reduce penalty (cross-node TP) |
| `ncclBwUtil` | NCCL BW Utilization | Fraction of theoretical NCCL bandwidth achieved | Ratio | 0–1, step 0.05 | NCCL-aware scaling efficiency |
| `pipelineBubblePct` | Pipeline Bubble Overhead (%) | Idle time fraction per pipeline stage transition | Percent | 0–50, step 1 | Pipeline bubble penalty |

### Serving Engine Card (CE-007)

| ID | Label | Meaning | Units | Range/Options | Feeds Into |
|----|-------|---------|-------|---------------|------------|
| `servingEngine` | Serving Engine | Inference serving framework | — | `raw`, `vllm`, `sglang`, `tgi` | KV waste, prefill eff, batch eff — affects all throughput |

#### vLLM Fields (visible when engine = vLLM)

| ID | Label | Meaning | Units | Range/Options | Feeds Into |
|----|-------|---------|-------|---------------|------------|
| `vllmBlockSize` | Block Size | Paged attention block size | Tokens | `16`, `32` | KV waste (1.15 for 16, 1.08 for 32), block waste rate |
| `vllmMaxNumBatchedTokens` | Max Batched Tokens | Maximum tokens processed per batch step | Tokens | 256–65536 | Batch efficiency constraint factor |
| `vllmMaxNumSeqs` | Max Sequences | Maximum concurrent sequences | Integer | 1–1024 | Batch efficiency constraint factor |

#### TGI Fields (visible when engine = TGI)

| ID | Label | Meaning | Units | Range/Options | Feeds Into |
|----|-------|---------|-------|---------------|------------|
| `tgiMaxBatchSize` | Max Batch Size | Maximum sequences per batch | Integer | 1–2048 | TGI batching multiplier, queue depth |
| `tgiMaxWaitingSeqs` | Max Waiting Sequences | Maximum sequences in waiting queue | Integer | 1–4096 | TGI queue depth |
| `tgiMaxTotalTokens` | Max Total Tokens | Maximum tokens in flight | Tokens | 256–262144, step 256 | TGI token budget constraint |

#### SGLang Fields (visible when engine = SGLang)

| ID | Label | Meaning | Units | Range/Options | Feeds Into |
|----|-------|---------|-------|---------------|------------|
| `sglangCacheHitRate` | Cache Hit Rate | RadixAttention prefix cache hit rate | Ratio | 0–1, step 0.05 | Radix multiplier, radix throughput |
| `sglangPrefixCacheSize` | Prefix Cache Size (GB) | VRAM allocated to prefix cache | GB | 0–1024, step 0.5 | Per-GPU VRAM competition with KV cache |
| `sglangRadixTreeOverhead` | Radix Tree Overhead (%) | Memory overhead of radix tree structure | Percent | 0–50 | Miss penalty in radix multiplier |

### Prefill Throughput Card (CE-013)

| ID | Label | Meaning | Units | Range/Options | Feeds Into |
|----|-------|---------|-------|---------------|------------|
| `promptLen` | Prompt Length (tokens) | Input prompt length for TTFT calculation | Tokens | 128–131072, step 128 | Prefill latency, TTFT |
| `prefillComputeEff` | Prefill Compute Efficiency | Fraction of peak TFLOPS achieved during prefill | Ratio | 0–1, step 0.05 | Prefill throughput (compute-bound) |
| `prefillBatchSize` | Prefill Batch Size (requests) | Number of concurrent prefill requests | Requests | 1–128 | Prefill latency, TTFT batch queuing factor |

### Speculative Decoding Card (CE-015)

| ID | Label | Meaning | Units | Range/Options | Feeds Into |
|----|-------|---------|-------|---------------|------------|
| `enableSpec` | Enable Speculative Decoding | Toggle speculative decoding on/off | Checkbox | checked/unchecked | Speculative throughput, speedup, draft model memory |
| `specDraftTokens` | Draft Tokens per Step | Number of tokens the draft model proposes per step | Integer | 1–10 | Boost factor |
| `specAcceptRate` | Acceptance Rate | Fraction of draft tokens accepted by target model | Ratio | 0–1, step 0.05 | Boost factor, acceptance display |
| `specDraftRatio` | Draft:Target Size Ratio | Draft model size as fraction of target | Ratio | 0.01–0.50, step 0.01 | Draft model memory |
| `specDraftOverhead` | Draft Overhead | Latency overhead of running the draft model | Ratio | 0–0.50, step 0.01 | Boost factor denominator |
| `specSharedGPU` | Draft model shares GPU with target | Whether draft runs on same GPU(s) as target | Checkbox | checked/unchecked | Draft model VRAM allocation note |

### Concurrent Users Card (CE-016)

| ID | Label | Meaning | Units | Range/Options | Feeds Into |
|----|-------|---------|-------|---------------|------------|
| `maxConcurrentUsers` | Max Concurrent Users | Expected peak concurrent users | Integer | 1–10000, step 1 | Latency scaling, saturation check, queue depth |
| `targetP50Latency` | Target P50 Latency (ms) | Target median latency per token | Milliseconds | 10–60000, step 10 | Base latency for queue scaling |
| `targetP95Latency` | Target P95 Latency (ms) | Target 95th percentile latency | Milliseconds | 10–120000, step 10 | Not used in current calculation (P95 = 2 × computed P50) |
| `queueDepthMultiplier` | Queue Depth Multiplier | How aggressively latency scales with users | Multiplier | 1–3, step 0.01 | Latency scaling, effective queue depth |
| `bandwidthUtilizationLimit` | Bandwidth Utilization Limit | Saturation threshold for request rate vs capacity | Ratio | 0.5–0.99, step 0.01 | Saturation check |

### Cloud Pricing Card

| ID | Label | Meaning | Units | Range/Options | Feeds Into |
|----|-------|---------|-------|---------------|------------|
| `cloudProvider` | Provider | Cloud GPU provider for pricing | — | `Lambda` (Lambda Labs), `RunPod`, `Vast.ai`, `CoreWeave` | Cloud price per GPU, cluster cost, monthly GPU cost, breakeven |

### API Pricing Card (CE-006)

| ID | Label | Meaning | Units | Range/Options | Feeds Into |
|----|-------|---------|-------|---------------|------------|
| `apiProvider` | API Provider | API inference provider for pricing comparison | — | `openrouter`, `together`, `fireworks` | API pricing lookup, breakeven analysis |

---

## Part 2: Output Metrics → Formula Reference

Every result card in the Results panel, mapped to its formula section in
[FORMULAS.md](FORMULAS.md).

| Result Card (label) | Element ID | Formula Section |
|---------------------|------------|-----------------|
| Model Memory (GB) | `rModelMem` | [§2 Model Memory](FORMULAS.md#2-model-memory) |
| KV Cache (GB) | `rKvCache` | [§3 KV Cache](FORMULAS.md#3-kv-cache) |
| VRAM / GPU (GB) | `rTotalPerGpu` | [§4.1 Per-GPU Memory](FORMULAS.md#4-gpu-fit) |
| GPUs Needed | `rGpusNeeded` | [§5.1 GPUs Needed](FORMULAS.md#5-gpu-count--sweet-spot-analysis) |
| Servers Needed | `rServersNeeded` | [§5.1 GPUs Needed](FORMULAS.md#5-gpu-count--sweet-spot-analysis) |
| Total Cluster VRAM (GB) | `rTotalCluster` | [§5.2 Total Cluster VRAM](FORMULAS.md#5-gpu-count--sweet-spot-analysis) |
| GPU Utilization % | `rUtil` | [§4.2 GPU Utilization](FORMULAS.md#4-gpu-fit) |
| System RAM (GB) | `rSysRam` | [§6 System RAM & NVMe](FORMULAS.md#6-system-ram--nvme-cache) |
| NVMe Cache (GB) | `rNvme` | [§6 System RAM & NVMe](FORMULAS.md#6-system-ram--nvme-cache) |
| Est. tok/$ (decode) | `rTokensPerDollar` | [§8 Tokens per Dollar](FORMULAS.md#8-tokens-per-dollar) |
| Est. Cost/hr | `rCostPerHour` | [§10 Cluster Cost per Hour](FORMULAS.md#10-cluster-cost-per-hour) |
| Sweet Spot | `rSweetSpot` | [§5.3 Sweet Spot](FORMULAS.md#5-gpu-count--sweet-spot-analysis) |
| Input Cost $/1M tok (CE-005) | `rCostInput` | [§9.1 Input Cost](FORMULAS.md#9-cost-per-1m-tokens-ce-005) |
| Output Cost $/1M tok (CE-005) | `rCostOutput` | [§9.2 Output Cost](FORMULAS.md#9-cost-per-1m-tokens-ce-005) |
| Breakeven tok/mo (CE-006) | `rBreakeven` | [§22.3 Breakeven](FORMULAS.md#22-api-pricing--breakeven) |
| Prefill Throughput tok/s (CE-013) | `rPrefillThroughput` | [§11 Prefill Throughput](FORMULAS.md#11-prefill-throughput-ce-013) |
| Decode Throughput tok/s (CE-013) | `rDecodeThroughput` | [§7 Decode Throughput](FORMULAS.md#7-decode-throughput) |
| Prefill Latency ms (CE-013) | `rPrefillLatency` | [§12.1 Prefill Latency](FORMULAS.md#12-prefill-latency--ttft) |
| TTFT ms (CE-014) | `rTTFT` | [§12.2 TTFT](FORMULAS.md#12-prefill-latency--ttft) |
| TTFT Batched ms (CE-014) | `rTTFTBatched` | [§12.2 TTFT](FORMULAS.md#12-prefill-latency--ttft) |
| Ready-to-Serve ms (CE-014) | `rTtftReady` | [§12.2 TTFT](FORMULAS.md#12-prefill-latency--ttft) |
| Spec. Decode Tput tok/s (CE-015) | `rSpecDecodeThroughput` | [§13 Speculative Decoding](FORMULAS.md#13-speculative-decoding-ce-015) |
| Speedup vs Baseline (CE-015) | `rSpecSpeedup` | [§13 Speculative Decoding](FORMULAS.md#13-speculative-decoding-ce-015) |
| Draft Model Mem GB (CE-015) | `rSpecDraftMem` | [§13 Speculative Decoding](FORMULAS.md#13-speculative-decoding-ce-015) |
| Acceptance Rate (CE-015) | `rSpecAcceptance` | [§13 Speculative Decoding](FORMULAS.md#13-speculative-decoding-ce-015) |
| Max Concurrent Users (CE-016) | `rMaxConcurrentUsers` | [§14 Concurrent Users](FORMULAS.md#14-concurrent-users-ce-016) |
| Requests/sec @ P50 (CE-016) | `rReqPerSec` | [§14 Concurrent Users](FORMULAS.md#14-concurrent-users-ce-016) |
| Latency @ Max Load (CE-016) | `rConcurrencyLatency` | [§14 Concurrent Users](FORMULAS.md#14-concurrent-users-ce-016) |
| Bandwidth Saturated? (CE-016) | `rSatReached` | [§14 Concurrent Users](FORMULAS.md#14-concurrent-users-ce-016) |
| Effective Queue Depth (CE-016) | `rQueueDepth` | [§14 Concurrent Users](FORMULAS.md#14-concurrent-users-ce-016) |
| Eff. Throughput tok/s (CE-007) | `rEffectiveThroughput` | [§7 Decode Throughput](FORMULAS.md#7-decode-throughput) |
| KV Waste % (CE-007) | `rKvWastePct` | [§15.1 Effective KV Waste](FORMULAS.md#15-serving-engine-overhead-ce-007) |
| Batch Efficiency (CE-007) | `rBatchEfficiency` | [§15.2 Batch Efficiency](FORMULAS.md#15-serving-engine-overhead-ce-007) |
| SGLang Radix Tput tok/s (CE-008) | `rSglangRadixThroughput` | [§16 SGLang RadixAttention](FORMULAS.md#16-sglang-radixattention-ce-008) |
| Cache Hit/Miss Ratio (CE-008) | `rSglangCacheNote` | [§16 SGLang RadixAttention](FORMULAS.md#16-sglang-radixattention-ce-008) |
| EP All-to-All Eff % (CE-012) | `rEpEfficiency` | [§18 Expert Parallelism](FORMULAS.md#18-expert-parallelism--moe-ce-012) |
| MoE-Adjusted GPUs (CE-012) | `rEpAdjustedGpus` | [§18 Expert Parallelism](FORMULAS.md#18-expert-parallelism--moe-ce-012) |
| Experts per GPU (CE-012) | `rExpertsPerGpu` | [§18 Expert Parallelism](FORMULAS.md#18-expert-parallelism--moe-ce-012) |
| MoE Mem Adjustment GB (CE-012) | `rMoEMemAdjustment` | [§18 Expert Parallelism](FORMULAS.md#18-expert-parallelism--moe-ce-012) |
| NVLink BW Utilization (CE-010) | `rNvlinkBwUtil` | [§19 NVLink Topology](FORMULAS.md#19-nvlink-topology-ce-010) |
| Cross-Node Penalty (CE-010) | `rCrossNodePenalty` | [§19 NVLink Topology](FORMULAS.md#19-nvlink-topology-ce-010) |
| Scaling Efficiency % (CE-011) | `rScalingEfficiency` | [§20 Multi-Node Scaling](FORMULAS.md#20-multi-node-scaling-ce-011) |
| Multi-Node Penalty (CE-011) | `rMultiNodePenalty` | [§20 Multi-Node Scaling](FORMULAS.md#20-multi-node-scaling-ce-011) |
| Eff. Tput w/ Scaling tok/s (CE-011) | `rEffectiveTputWithScaling` | [§20 Multi-Node Scaling](FORMULAS.md#20-multi-node-scaling-ce-011) |

---

## Part 3: Configuration Management

### getConfig() / setConfig()

The tool serializes ALL input controls (except `presetFilter` and `modelPreset`
which are selectors, not state) into a flat JSON object. The following keys are
included in export/import/save/load/share-link operations:

**Core model & quantization:** `params`, `arch`, `activeParams`, `nLayers`,
`nKvHeads`, `headDim`, `hiddenSize`, `quant`, `kvPrecision`, `context`,
`batchSize`, `overhead`

**GPU config:** `gpuModel`, `customVram`, `gpuPerServer`, `numServers`,
`servingMode`, `tpSize`, `ppSize`, `cloudProvider`, `apiProvider`

**Serving engine:** `servingEngine`, `vllmBlockSize`, `vllmMaxNumBatchedTokens`,
`vllmMaxNumSeqs`, `tgiMaxBatchSize`, `tgiMaxWaitingSeqs`, `tgiMaxTotalTokens`,
`sglangCacheHitRate`, `sglangPrefixCacheSize`, `sglangRadixTreeOverhead`

**Expert parallelism:** `numExperts`, `topK`, `epSize`, `allToAllOverhead`,
`loadBalancePenalty`

**Topology:** `nvlinkTopo`, `nvlinkIntraNodeBw`, `nvlinkInterNodeBw`,
`tpCrossNode`, `ppCrossNode`

**Scaling:** `scalingModel`, `ncclAllReduceLatencyUs`, `ncclBwUtil`,
`pipelineBubblePct`

**Prefill:** `promptLen`, `prefillComputeEff`, `prefillBatchSize`

**Speculative decoding:** `enableSpec` (checkbox), `specDraftTokens`,
`specAcceptRate`, `specDraftRatio`, `specDraftOverhead`, `specSharedGPU`
(checkbox)

**Concurrency:** `maxConcurrentUsers`, `targetP50Latency`, `targetP95Latency`,
`queueDepthMultiplier`, `bandwidthUtilizationLimit`

### Share Link Encoding

Share links use URL hash encoding (`#` + base64 of JSON config):
`encodeConfigToHash()` serializes `getConfig()` to JSON, base64-encodes it, and
sets `window.location.hash`. On page load, `decodeHashToConfig()` decodes the
hash and applies it via `setConfig()`.

---

*For formula derivations, see [FORMULAS.md](FORMULAS.md). For a worked example,
see [QUICKSTART.md](QUICKSTART.md).*
