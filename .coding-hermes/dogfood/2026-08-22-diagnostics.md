# Inference Estimator — Diagnostic Trail (2026-08-22)

This is the "how it's built and why" record for the inference-estimator
project, extended after the second dogfood run. It explains the architecture
and the failure modes found by REAL USE — not raw logs. Companion:
`2026-08-22-integration.md` (what works and how to use it).

## How the tool is built (the 30-second version)

- **One file, three layers.** `cluster-estimator.html` is HTML + CSS + ~2,300
  lines of vanilla JS in one file: (1) input layer — selects/sliders/buttons
  that all call `recalculate()`; (2) compute layer — `recalculate()` reads
  every field, applies the CE-xxx formulas (documented in `docs/FORMULAS.md`
  with line references), writes ~45 result rows; (3) state layer —
  `getConfig()`/`setConfig()` (60-field JSON), localStorage save/load, and a
  base64 JSON **URL hash** that syncs on every recalculate (~500ms debounce)
  and restores on load (`decodeHashToConfig()`).
- **Model library.** `models/*.json` (60 files + `index.json`) fetched at
  runtime when served over HTTP; the standalone build inlines them. The
  embedded fallback in the HTML is the same data. `refreshModelUI()` swaps the
  full library in and **re-decodes the hash after load** — that late re-decode
  is IE-GAP-020's fix (preset restore).
- **Math model.** Memory: `modelMem = activeParams × bpw/8 × (1+overhead)`
  (compute path) vs `tensorMem = totalParams × bpw/8` sharded by TP (resident
  weights). KV: `2 × layers × kvHeads × headDim × kvBpw × ctx × batch / 1e9 ×
  engineWaste` (raw 1.30 / vLLM 1.15 / sglang 1.10 / tgi 1.20 — vLLM block
  size 32 → 1.08). GPU fit: `totalPerGpu = tensorMem/(TP×PP) × (1+overhead) +
  kvPerGpu` where **disaggregated mode leaves KV unsharded** (`kvPerGpu =
  kvWithEngine` instead of `/TP`) — documented in FORMULAS §4.1, and the
  source of IE-GAP-032. GPUs needed: `max(ceil(totalPerGpu/(vram×0.9)),
  TP×PP)` — the TP×PP floor dominates for big models.
- **Throughput.** Decode is bandwidth-bound (`gpu.bw / (effParams × bpw/8 /
  TP)`); prefill is compute-bound (`tflops / (2 × effParams × bpw/8 / TP) ×
  computeEff`). Engines adjust KV waste, batch efficiency, and (TGI) a
  continuous-batching multiplier. Speculative decoding adds a draft-model
  branch. Concurrency (CE-016) turns throughput into req/s at P50/P95 with a
  saturation flag.

## Failure modes found by real use (2026-08-22)

### 1. CE-010 interconnect: the feature that computes but never decides
`recalculate()` computes `tpFitsNode = ceil(gpusNeeded/TP) ≤ gpusPerServer`
and `tpIsCrossNode = policy=='cross-node' || (auto && !tpFitsNode && TP >
gpusPerServer)`. With gpusNeeded=16, TP=16, gpusPerServer=8:
`ceil(16/16)=1 ≤ 8` → "fits" → **auto never fires**, even though the TP group
spans two servers. The quantity that matters is `TP ≤ gpusPerServer` (does
one TP group fit inside a node). Same class of bug in `ppFitsNode` (it uses
`gpusNeeded/PP`, the number of PP groups, not the GPUs a PP stage needs).
And when the penalty DOES fire (policy forced): `nvlinkAdjustedGpus =
ceil(gpusNeeded × penalty)` feeds nothing visible — dense result rows print
"N/A (dense)", MoE overwrites it with the EP-adjusted count, and GPUs Needed /
scaling / throughput / cost are untouched. **Lesson: a metric that is computed
but never wired into a decision is dead weight that still gets displayed as a
feature.** Either wire it (adjust GPUs Needed or scaling efficiency) or label
the rows informational.

### 2. Disaggregated mode: documented math, undocumented infeasibility
FORMULAS §4.1 deliberately keeps KV unsharded per GPU in disaggregated mode
(prefill GPUs hold model weights, decode GPUs hold full KV). Consequence:
DeepSeek V3 Q4_K_M 32K at TP8 needs 96.6 GB/GPU — infeasible on H100-80 — but
the tool reports GPUs Needed = 8 (the `max(ceil(...), TP×PP)` floor) and
Sweet Spot "Tight fit — no headroom". The util cell turns red (`metric bad`,
>95%), which is the only signal. **Lesson: when the headline answer (GPUs
Needed) is computed from a floor while the feasibility condition (per-GPU
VRAM ≤ GPU VRAM) is violated, the floor must not win silently.** Real
disaggregated deployments (vLLM PD, the standard for this model class) shard
KV across decode GPUs, so the tool's model is also more conservative than
reality — worth revisiting, but the infeasibility flag is the urgent fix.

### 3. TGI's continuous-batching multiplier (CE-009) is a linear occupancy proxy
`tgiBatchingMultiplier = min(batchSize/maxBatchSize, tokenBudgetRatio) ×
0.75`. Steady-state concurrency is modeled as `batch/maxBatch`, so batch 8
against max 128 = 6.25% × 0.75 → 80 tok/s on 8×H100 (vs vLLM 1,523) and
$68.75/1M output tokens. In reality TGI serves 8 concurrent sequences at full
step throughput; the batch ratio measures a capacity ceiling, not utilization.
**Lesson: a "comparison" feature must compare within the same plausibility
band, or it manufactures a winner.** The vLLM headroom model (constraint
factors averaged, `1 - (1-batchEff)×constraint`) is the sane pattern; TGI's
should be reworked to it or caveated.

### 4. Display units that lie politely
- "KV Waste % = 115.0%" — that's the size multiplier (cache = 115% of raw =
  15% waste). FORMULAS §15.1 even contains an in-doc "Wait — actually…"
  self-correction. The label and the value disagree about what is being
  measured.
- "MoE-Adjusted GPUs = 10" beside "GPUs Needed = 8" at defaults: EP overhead
  (all-to-all 5%×(experts/EP)×(topK/experts) + 10% load imbalance) applies
  even when `epSize=1` (EP disabled). The notes text explains it; the results
  row doesn't.
- Silent quant clamp: `quantBpw = parseFloat(...) || 4.5` (IE-GAP-019's fix)
  means an out-of-list quant like "3.5" quietly becomes Q4_K_M. Great for
  killing NaN; bad for the user who exported 3.5 bpw. The banner only fires
  on blank quant.

## The right way (patterns that held up)

- **Known-answer regression is the backbone.** The worked example (23.9 /
  42.37 / 59.6 / 8 / 74.4 / 1523 / 80865 / 19.92 / 26.4B) reproduces
  byte-for-byte on both distributions and is asserted in test.js + the
  foreman's board-evidence gate. Any math change that doesn't move these is
  safe; any that does is caught. This is why 60-model preset expansion and
  the IE-GAP-019..022 fixes shipped without breaking the core.
- **Defensive fallbacks (`|| default`) on every numeric field** — the pattern
  IE-GAP-019 extended to quant — convert NaN classes into visible clamps.
- **The `metric` div classing (`ok`/`warn`/`bad`) for util** gives an
  at-a-glance color signal; extend the pattern to the sweet spot verdict so
  the text matches the color.
- **Hash-as-state with late re-decode after library load** is a robust share
  mechanism (verified cold-load in a fresh browser, hash overrides
  localStorage as documented).
- **Board evidence + E2E battery keep the foreman honest** — but the battery
  checks UI presence, not model behavior: it would not catch IE-GAP-031..033.
  Next battery iteration should assert at least one cross-node/interconnect
  and one disaggregated scenario (the exact gaps here).

## Environment notes

- Chrome 149 headless via CDP; repo served on :8199 (8123 was taken by
  another fleet project). Test harness + scenarios: `/tmp/dogfood-ie/`.
- All scenarios: zero console errors, zero warnings, both distributions.
- npm test 10/10 groups in 3.1s (presets 60/60, roundtrip, edges, GAP
  regressions, known-answers, hash/import hardening, alphabetical, docs
  consistency, dist freshness, board evidence).
