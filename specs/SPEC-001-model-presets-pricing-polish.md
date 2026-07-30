# SPEC-001 — Inference Cluster Estimator Worker Spec

## 1. Purpose
Enhance the single-file static HTML GPU cluster estimator with model presets, cloud pricing, serving engine models, advanced topology modeling, throughput modeling, and UI polish. All work is frontend JS/CSS/HTML — single file, zero dependencies, dark theme.

## 2. Architecture Constraint
**Single file rule:** All changes go into `cluster-estimator.html`. No new JS files, no CSS files, no build step, no npm, no framework. Inline `<style>` and `<script>` only. This constraint applies to ALL phases — presets, pricing data, topology math, throughput models, service worker registration, everything.

## 3. Phase Implementation Details

### Phase 1 — Model Presets (CE-001, CE-002, CE-003)

**CE-001/002: Add `<select id="modelPreset">` to Model card with an `onchange` handler.**

Preset data structure (JS object):
```javascript
const MODEL_PRESETS = {
  'llama-3-70b': {
    name: 'Llama 3 70B',
    params: 70, arch: 'dense', nLayers: 80, nKvHeads: 8, headDim: 128, hiddenSize: 8192,
    desc: 'Meta Llama 3 — 70B dense, 80 layers, GQA (8 KV heads), 128 head dim'
  },
  'llama-4-400b-moe': {
    name: 'Llama 4 400B (MoE)',
    params: 400, arch: 'moe', activeParams: 40, nLayers: 126, nKvHeads: 8, headDim: 128, hiddenSize: 16384,
    desc: 'Meta Llama 4 Behemoth — 400B total, ~40B active, 16 experts, 126 layers'
  },
  'deepseek-v3': {
    name: 'DeepSeek V3',
    params: 671, arch: 'moe', activeParams: 37, nLayers: 61, nKvHeads: 8, headDim: 128, hiddenSize: 7168,
    desc: 'DeepSeek V3 — 671B total MoE, 37B active, MLA attention, 61 layers'
  },
  'deepseek-v4': {
    name: 'DeepSeek V4',
    params: 685, arch: 'moe', activeParams: 37, nLayers: 61, nKvHeads: 8, headDim: 128, hiddenSize: 7168,
    desc: 'DeepSeek V4 — 685B total MoE, 37B active, enhanced MLA'
  },
  'mixtral-8x22b': {
    name: 'Mixtral 8×22B',
    params: 141, arch: 'moe', activeParams: 39, nLayers: 56, nKvHeads: 8, headDim: 128, hiddenSize: 6144,
    desc: 'Mistral Mixtral 8×22B — 141B total, 39B active, 8 experts (top-2), 56 layers'
  },
  'qwen-2.5-72b': {
    name: 'Qwen 2.5 72B',
    params: 72, arch: 'dense', nLayers: 80, nKvHeads: 8, headDim: 128, hiddenSize: 8192,
    desc: 'Alibaba Qwen 2.5 — 72B dense, 80 layers, GQA'
  },
  'minimax-m3-moe': {
    name: 'MiniMax-M3 (MoE)',
    params: 456, arch: 'moe', activeParams: 45.9, nLayers: 72, nKvHeads: 8, headDim: 128, hiddenSize: 8192,
    desc: 'MiniMax M3 — 456B total MoE, 45.9B active, 72 layers, hybrid attention'
  },
  'gemma-3-27b': {
    name: 'Gemma 3 27B',
    params: 27, arch: 'dense', nLayers: 46, nKvHeads: 8, headDim: 128, hiddenSize: 4608,
    desc: 'Google Gemma 3 — 27B dense, 46 layers, GQA'
  },
  'mistral-large-2': {
    name: 'Mistral Large 2',
    params: 123, arch: 'dense', nLayers: 88, nKvHeads: 8, headDim: 128, hiddenSize: 12288,
    desc: 'Mistral Large 2 — 123B dense, 88 layers, GQA'
  },
};
```

The preset dropdown sits at the top of the Model card. Selecting a preset calls `applyPreset()` which sets all model fields then calls `recalculate()`.

**CE-003:** Add a `<div id="presetDesc" class="notes">` below the preset dropdown showing the selected model's description string on change.

### Phase 2 — Pricing (CE-004, CE-005, CE-006)

**CE-004:** Add a "Pricing" card. Add `GPU_SPECS` with `price_hour` already has values. Add a `<select id="cloudProvider">` with: Lambda Labs, RunPod, Vast.ai, CoreWeave. Each provider has multipliers against the base GPU price (Lambda=1.0, RunPod=0.7, Vast=0.5, CoreWeave=1.2).

**CE-005:** New output metrics:
- `rCostPer1MInput` — cost per 1M input tokens (based on prefill time × GPU price)
- `rCostPer1MOutput` — cost per 1M output tokens (based on decode time × GPU price)
- `rCostPer1MCombined` — blended cost at typical 3:1 output:input ratio

**CE-006:** Breakeven analysis section in results:
- OpenRouter price for equivalent model (hardcoded lookup by model name)
- Self-hosted cost per 1M tokens vs API price
- "Breakeven" — tokens/day needed to make self-hosting cheaper than API

### Phase 3 — Serving Engines (CE-007, CE-008, CE-009)

Add a `<select id="servingEngine">` with: Raw/vLLM/SGLang/TGI. Each applies efficiency multipliers:

```javascript
const SERVING_OVERHEAD = {
  raw:    { kvWaste: 1.30, prefillEff: 1.00, batchEff: 1.00 },
  vllm:   { kvWaste: 1.15, prefillEff: 0.85, batchEff: 0.70 },
  sglang: { kvWaste: 1.10, prefillEff: 0.80, batchEff: 0.65 },
  tgi:    { kvWaste: 1.20, prefillEff: 0.90, batchEff: 0.75 },
};
```

- `kvWaste` — multiplies KV cache (paged attention reduces fragmentation waste)
- `prefillEff` — multiplies prefill compute time (chunked prefill / RadixAttention)
- `batchEff` — multiplies effective batch throughput (continuous batching)

### Phase 4 — Advanced Topology (CE-010, CE-011, CE-012)

**CE-010:** Add a `nvlink` checkbox + `nvlinkDomain` number field (default 8 for DGX). When enabled, GPUs within NVLink domain share model weights with near-zero overhead. Adjusts effective model-per-GPU calculation.

**CE-011:** Multi-node scaling efficiency curve. Add `nodeCount` slider (derived from GPU count / GPUs-per-server). Apply efficiency curve:
- 1 node: 100%
- 2 nodes: 95%
- 4 nodes: 88%
- 8 nodes: 78%
- 16+ nodes: 65%
Interpolate between points.

**CE-012:** MoE Expert Parallelism. When `arch === 'moe'` and `servingMode === 'disaggregated'`, add EP dimension: how many GPUs hold expert shards. Add `epSize` number field (default 1). EP reduces per-GPU model memory by `epSize` factor for the MoE layers (roughly 80% of total params for typical architectures).

### Phase 5 — Throughput (CE-013, CE-014, CE-015, CE-016)

**CE-013:** New output: Prefill throughput. Based on GPU compute FLOPS (add to GPU_SPECS: `H100-80: 989 TFLOPS BF16`, etc.) divided by model compute cost per token (~2× params floating point ops per token).

**CE-014:** TTFT = (prompt_tokens × 2 × activeParams_B × 1e9) / (gpuFLOPS × numGPUs × prefillEff). Default prompt length field: 1024 tokens.

**CE-015:** Speculative decoding. Add toggle + draft model size field (default 0.5B). Speedup = 1 + (0.3 × √(target_params/draft_params)) for compatible architectures. Cap at 3×.

**CE-016:** Concurrent users. Given target TTFT budget (e.g., 500ms) and per-request TTFT, max concurrent = budget / per-request-TTFT × numGPUs. Model as simple queue: requests arrive, each GPU can process one prefill at a time.

### Phase 6 — Polish (CE-017, CE-018, CE-019, CE-020, CE-021)

**CE-017:** Theme toggle. Add `<button id="themeToggle" class="primary" onclick="toggleTheme()">🌙 Dark</button>` to button row. `toggleTheme()` swaps `:root` CSS vars between dark and light palettes. Persist preference in localStorage.

**CE-018:** Shareable URL. `exportConfig()` also copies a URL with `?config=<base64 JSON>` to clipboard. On page load, check URL params and auto-apply config. Use `URLSearchParams` + `atob`.

**CE-019:** Comparison mode. Add "Compare" button. When active, shows two columns side-by-side — left is current config, right is config B. "Copy to B" button. "Exit Compare" button. Each column shows condensed results.

**CE-020:** Print-friendly CSS. Add `@media print` block that hides buttons, form elements, and shows results cleanly on white background with black text.

**CE-021:** Service Worker. Register a service worker that caches `cluster-estimator.html` for offline use. Inline the SW registration, handle install/activate/fetch. Simple cache-first strategy. The SW file itself should be a self-registering blob URL (no separate file needed) since the constraint is single-file.

## 4. Error Handling
- Invalid JSON import: show error toast, keep current config
- localStorage full: silently degrade, no crash
- Missing GPU FLOPS data: fall back to memory-bandwidth-only throughput estimate
- Division by zero (0 GPUs): guard all division operations, show "—" for undefined metrics

## 5. Testing
- Every preset applies correct values → verify all 9 presets
- Preset then custom edit: manual edits survive preset changes (presets only set on dropdown change, not on recalculate)
- JSON export→import roundtrip: all fields preserved
- localStorage save→reload: config survives page refresh
- Comparison mode: both columns calculate independently
- Dark→light theme: all elements readable, SVG/colors adapt
- URL share: config survives base64 encode→decode roundtrip
- Offline: Service Worker serves cached page
- Print: no buttons visible, clean layout
- Edge: 0 GPUs, 1B param model, 1M context, FP32 quant — all produce numbers not NaN

## 6. File Impact
- **Modified:** `cluster-estimator.html` — all changes in one file
- **No new files** (except service worker if separate file approach chosen, but blob URL preferred)
