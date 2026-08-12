# Inference Cluster Estimator — Quick Start Guide

This guide walks through a single fully-worked example: sizing a cluster for
**DeepSeek V3**. Every number shown was produced by the tool's actual formulas
(replicated in `docs/example-calc.js` — run `node docs/example-calc.js` to
verify).

---

## How to Use (5-Step Summary)

1. **Open** `cluster-estimator.html` in any browser (double-click or
   `file://` URL — no server needed). Note: from `file://` the tool runs on
   its embedded fallback data — all 60 presets and API pricing are baked in,
   but live model updates are unavailable (a console warning explains this).
   Serve the directory over HTTP (`python3 -m http.server 8000`) for the full
   live-update experience.
2. **Select a model preset** from the dropdown (or enter parameters manually).
3. **Set context, batch, and quantization** to match your deployment scenario.
4. **Choose your GPU model, TP/PP, and server count.**
5. **Read the Results panel** — VRAM, GPU count, throughput, cost, and
   sweet-spot analysis update instantly.

### Features

| Feature | Button | Description |
|---------|--------|-------------|
| Export JSON | "Export JSON" | Downloads current configuration as `cluster-config.json`. |
| Import JSON | "Import JSON" | Loads a previously exported `.json` config file. |
| Save to Browser | "Save to Browser" | Persists config to localStorage (survives page reload). |
| Load Saved | "Load Saved" | Restores the last saved configuration. |
| Share Link | "🔗 Copy Link" | Copies a URL with the full config encoded in the `#hash`. Anyone opening it gets your exact configuration. |
| Compare Mode | "⚖ Compare" | Side-by-side comparison of two configurations (Pane A / Pane B). |
| Theme Toggle | "☀️ Light" | Switch between dark and light themes. |
| Recalculate | "Recalculate" | Manually trigger recalculation (normally automatic). |

---

## Worked Example: DeepSeek V3 on H100 GPUs

### Step 1 — Select the Model

In the **Model** card:

1. Set **Filter by architecture** to `All` (or `MoE`).
2. Select **DeepSeek V3** from the **Preset** dropdown.

The tool auto-fills these values from `models/deepseek-v3.json`:

| Field | Value | Source |
|-------|-------|--------|
| Number of Parameters | 671.0 B | Total (all experts) |
| Architecture | MoE | Mixture of Experts |
| Active Parameters | 37.0 B | Parameters active per token |
| Number of Layers | 61 | Transformer layers |
| KV Heads | 1 | MLA (single KV head with low-rank compression) |
| Head Dim | 576 | MLA latent dimension (512 compressed + 64 rope) |
| Hidden Size | 7,168 | Model hidden dimension |

### Step 2 — Set Quantization & Context

In the **Quantization & Context** card:

| Field | Value | Notes |
|-------|-------|-------|
| Quantization | Q4_K_M (~4.5 bpw) | Standard 4-bit quantization |
| KV Cache Precision | FP16 | Full-precision KV cache |
| Context Length | 32,768 tokens | Typical production context |
| Batch Size | 8 requests | Concurrent sequences |
| Model Overhead | 15% | CUDA kernels, activation buffers |

### Step 3 — Configure GPUs

In the **GPU Configuration** card:

| Field | Value | Notes |
|-------|-------|-------|
| GPU Model | NVIDIA H100 (80 GB) | Target hardware |
| GPUs per Server | 8 | Standard 8-GPU node |
| Number of Servers | 1 | Single-node deployment |
| Serving Mode | Monolithic | Prefill + decode on same GPU |
| Tensor Parallel Size | 8 | Shard across all 8 GPUs |
| Pipeline Parallel Size | 1 | Single pipeline stage |

### Step 4 — Other Defaults (Left at Defaults)

These remain at their default values for this example:

| Card | Key Fields |
|------|-----------|
| Serving Engine | vLLM, Block Size 16, Max Batched Tokens 8,192, Max Sequences 256 |
| Prefill Throughput | Prompt 4,096 tokens, Compute Eff 50%, Batch 1 |
| Speculative Decoding | Enabled, 3 draft tokens, 80% acceptance, 10% ratio, 15% overhead, shared GPU |
| Concurrent Users | 100 users, P50 500ms, P95 2000ms, Queue Depth 1.5×, BW limit 90% |
| Cloud Pricing | Lambda Labs |
| API Pricing | OpenRouter |

### Step 5 — Read the Results

The **Results** panel shows these values (all verified against
`docs/example-calc.js`):

#### Memory

| Metric | Value | How it's computed |
|--------|-------|-------------------|
| **Model Memory** | **23.9 GB** | 37B active × (4.5/8) × 1.15 overhead = 23.93 GB |
| **KV Cache** | **42.37 GB** | 2 × 61 × 1 × 576 × 2 bytes/tok × 32768 × 8 / 1e9 × 1.15 (vLLM waste) |
| **VRAM / GPU** | **59.6 GB** | (671B × 4.5/8 / 8TP) × 1.15 + 42.37/8 = 47.18 + 5.30 + 0 = 59.55 GB |
| **GPU Utilization** | **74.4%** | 59.55 / 80 × 100 = 74.4% (green — healthy) |

#### GPU Count

| Metric | Value | Notes |
|--------|-------|-------|
| **GPUs Needed** | **8** | max(ceil(59.55 / (80 × 0.90)), 8 × 1) = max(1, 8) = 8 — TP×PP floor (IE-GAP-011) |
| **Servers Needed** | **1** | ceil(8 / 8) = 1 |
| **Total Cluster VRAM** | **640 GB** | 8 GPUs × 80 GB |
| **Sweet Spot** | **Tight fit — no headroom** | 8 configured − 8 needed = 0 spare |

The memory calculation alone fits in a single H100 (ceil(59.55 / (80 × 0.90))
= 1 GPU), but TP=8 × PP=1 requires all 8 GPUs to be present — the tool
enforces this floor (gpusNeeded = max(VRAM-fit, TP × PP), IE-GAP-011). All 8
GPUs are used for the TP=8 shard, so the cluster has no spare capacity.

#### System Resources

| Metric | Value | Formula |
|--------|-------|---------|
| **System RAM** | **42 GB** | 20.81 × 2 |
| **NVMe Cache** | **62 GB** | 20.81 × 3 |

#### Throughput

| Metric | Value | Formula |
|--------|-------|---------|
| **Decode Throughput** | **1,523 tok/s** | 3350 / (37 × 4.5/8 / 8) = 1287.7 raw ÷ 0.845 batch eff |
| **Prefill Throughput** | **80,865 tok/s** | 990T × 1e12 / (2 × 37 × 1e9 × 4.5/8 / 8) × 0.50 × 0.85 |
| **Tokens/$** | **2.19M tok/$** | 1523 × 3600 / 2.50 |
| **Eff. Throughput (CE-007)** | **1,523 tok/s** | Same as decode throughput |

#### Latency

| Metric | Value | Formula |
|--------|-------|---------|
| **Prefill Latency** | **50.7 ms** | 4096 × 1 / 80865 × 1000 |
| **TTFT** | **51 ms** | 4096 / 80865 × 1000 |
| **TTFT Batched** | **51 ms** | 51 × 1.00 (batch=1, queuing factor 1.00) |
| **Ready-to-Serve** | **4,838 ms** | 51 + (23.93 × 200) — includes cold model load |

#### Cost

| Metric | Value | Formula |
|--------|-------|---------|
| **Est. Cost/hr** | **$19.92/hr** | $2.49 × 8 GPUs (Lambda Labs H100 price) |
| **Input Cost** | **$0.07/1M tok** | (1M / 80865 / 3600) × $2.49 × 8 |
| **Output Cost** | **$3.63/1M tok** | (1M / 1523 / 3600) × $2.49 × 8 |

#### Speculative Decoding

| Metric | Value | Formula |
|--------|-------|---------|
| **Spec. Decode Tput** | **4,504 tok/s** | 1523 × (1 + 0.80 × 3) / (1 + 0.15) = 1523 × 2.957 |
| **Speedup** | **2.96×** | (1 + 0.80 × 3) / (1 + 0.15) = 3.4 / 1.15 |
| **Draft Model Mem** | **2.4 GB** | 23.93 × 0.10 |
| **Acceptance Rate** | **80%** | User input |

#### Concurrency

| Metric | Value | Formula |
|--------|-------|---------|
| **Max Concurrent Users** | **100** | User input |
| **Requests/sec @ P50** | **5.95 req/s** | 1523 / 256 tokens-per-request |
| **Latency @ Max Load** | **P50: 1,243ms / P95: 2,485ms** | 500 × (1 + 99 × 1.5 × 0.01) |
| **Bandwidth Saturated?** | **Yes ⚠️** | 100 / 5.95 = 16.8 > 0.90 limit |
| **Effective Queue Depth** | **150** | 1.5 × 100 |

The saturation warning means that at 100 concurrent users, the system cannot
keep up — the request arrival rate exceeds the processing capacity at the 90%
bandwidth utilization limit.

#### API Breakeven (OpenRouter)

| Metric | Self-Hosted | API (OpenRouter) |
|--------|------------|------------------|
| Input ($/1M tok) | $0.07 | $0.27 |
| Output ($/1M tok) | $3.63 | $1.10 |
| **Breakeven** | **26.4B output tok/mo** | At 50% utilization ($29,083/mo GPU cost) |

This means you need to generate at least 26.4 billion output tokens per month
to justify self-hosting over the OpenRouter API. Below that volume, the API
is cheaper.

---

## Reproducing This Example

To verify every number above:

```bash
node docs/example-calc.js
```

This script replicates `recalculate()` from `cluster-estimator.html` with the
exact inputs listed in Steps 1–4 and prints every intermediate and final value.
The formula references are in [FORMULAS.md](FORMULAS.md).

### Manual Verification

You can also hand-compute the key formulas:

**Model memory:**
```
37B × (4.5 / 8) = 20.81 GB
20.81 × 1.15 = 23.93 GB
```

**KV cache per token:**
```
2 × 61 layers × 1 KV head × 576 dim × (16/8) = 140,544 bytes/token
140,544 × 32768 × 8 / 1e9 = 36.84 GB (× 1.15 vLLM waste = 42.37 GB)
```

**Per-GPU memory (TP=8):**
```
Model: 671B × (4.5/8) / 8 TP = 47.18 GB → × 1.15 overhead = 54.26 GB
KV:    42.37 / 8 = 5.30 GB
Total: 54.26 + 5.30 = 59.55 GB  →  fits in 80 GB H100 (74.4% util)
```

**Decode throughput:**
```
3350 GB/s / (37B × 4.5/8 / 8 TP) = 3350 / 2.602 = 1287.7 tok/s raw
1287.7 / 0.845 (batch eff) = 1523 tok/s effective
```

---

*For complete formula derivations, see [FORMULAS.md](FORMULAS.md). For input
field definitions, see [GLOSSARY.md](GLOSSARY.md).*
