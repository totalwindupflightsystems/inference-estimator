# Inference Estimator — Dogfood Integration Report (2026-08-22)

Second real-use field test (first: 2026-08-11). Headless Chrome 149 via raw CDP
(real DOM/JS, real file import, real share-link cold loads, real downloads —
no test-harness shortcuts). Verdict: **SHIPPABLE with caveats** — the core
promise holds byte-for-byte; the new-surface features (interconnect topology,
disaggregated serving, TGI engine model) have real gaps filed as
IE-GAP-031..036.

## Promise (null hypothesis)

> "Model params + quantization + context → VRAM, KV cache, GPUs needed, sweet
> spot" — a zero-dependency single-file HTML tool that sizes an LLM inference
> cluster in any browser. 60 model presets, GPU specs, serving engines
> (vLLM/SGLang/TGI), TP/PP + EP sharding, MoE, NVLink/InfiniBand multi-node
> topology, speculative decoding, concurrency modeling, cloud + API pricing,
> export/import/save/share/compare. Two distributions: `cluster-estimator.html`
> (live `models/` library over HTTP) and `dist/inference-estimator-standalone.html`
> (offline, `file://`).

## How to use it for real (verified again, 2026-08-22)

1. `python3 -m http.server 8000` → `http://localhost:8000/cluster-estimator.html`
   (or double-click `dist/inference-estimator-standalone.html` for offline —
   identical numbers, zero network requests, zero console errors).
2. Pick a preset (60 models, alphabetically sorted + filter). Presets fill
   params/arch/layers/KV heads/head dim but **not** quantization — set it
   explicitly (default Q4_K_M 4.5).
3. Set context/batch/overhead, GPU, servers, TP/PP, engine. Results update
   instantly; the URL hash syncs your state (~500ms debounce) — that hash IS
   the share link.
4. Persistence: Save to Browser (localStorage) / Load Saved / Export JSON /
   Import JSON / 🔗 Copy Link. Compare mode for A/B.

## Verified numbers (regression, byte-exact)

DeepSeek V3, Q4_K_M, FP16 KV, 32,768 ctx, batch 8, 15% overhead, 8×H100-80,
TP=8/PP=1, vLLM, Lambda — on BOTH distributions:

| Metric | 08-11 promise | 2026-08-22 measured |
|---|---|---|
| Model Memory | 23.9 GB | 23.9 ✓ |
| KV Cache | 42.37 GB | 42.37 ✓ |
| VRAM / GPU | 59.6 GB | 59.6 ✓ |
| GPUs Needed | 8 | 8 ✓ |
| GPU Utilization | 74.4% | 74.4% ✓ |
| Decode Throughput | 1,523 tok/s | 1,523 ✓ |
| Prefill Throughput | 80,865 tok/s | 80,865 ✓ |
| Est. Cost/hr | $19.92 | $19.92 ✓ |
| Breakeven | 26.4B tok/mo | 26.4B ✓ |
| Sweet Spot | Tight fit — no headroom | ✓ |

New-preset math hand-check (GPT-OSS 120B preset, Q4_K_M, 32K ctx, batch 8,
8×H100 TP8): fields fill 127B/12.5B active/36 layers/8 KV heads/64 head dim
(matches the model card); Model Memory 8.1 GB = 12.5×4.5/8×1.15 ✓; KV 22.23 GB
= 2×36×8×64×2×32768×8/1e9×1.15 ✓; VRAM/GPU 13.0 GB = (127×4.5/8/8)×1.15 +
22.23/8 ✓ (total params for sharding, active for compute — per FORMULAS §4.1);
util 16.3%. All consistent.

## Gap fixes from 2026-08-11 — verified fixed

- **IE-GAP-019 (NaN on invalid quant): FIXED.** Real file import of a config
  with `quant: "3.5"` (not an option): no NaN anywhere; results computed at the
  clamped default 4.5 bpw (23.9 GB model memory etc.). Share-link with blank
  quant likewise finite (test.js now covers both paths).
- **IE-GAP-020 (preset not serialized): FIXED.** Share link built with
  DeepSeek V4 Flash + 131K ctx + H200, cold-loaded in a fresh page: preset
  dropdown = `deepseek-v4-flash`, ctx 131072, gpu H200-141 ✓.
- **IE-GAP-021 (no validation UX): FIXED.** `validationBanner` shows
  "⚠ Select a quantization." when the quant select is blank; hidden on valid
  input. (Banner does NOT fire for out-of-list-but-numeric quant — that's the
  silent-clamp note, IE-GAP-036.)
- **IE-GAP-022 (test gaps): FIXED.** test.js now includes share-link cold
  load, real import path, poisoned-quant regressions: 10/10 groups, 3.1s.

## New-surface findings (this run — all filed as tasks)

| # | Finding | Evidence |
|---|---|---|
| IE-GAP-031 | **Interconnect topology (CE-010) is inert** — auto cross-node detection never fires (tpFitsNode formula measures the wrong quantity), and even forced, the ×1.19 penalty changes no computed result (GPUs Needed / scaling / throughput / cost identical across NVLink/NVSwitch/InfiniBand/PCIe5) | TP=16, 2 servers ×8×H100: "Cross-Node Penalty = None (intra-node)" in auto; forced → ×1.19 (NVLink, ratio 18:1) / ×1.00 (InfiniBand, ratio 1:1) — formula exact, zero downstream effect |
| IE-GAP-032 | **Disaggregated mode reports infeasible configs as "Tight fit"** — 96.6 GB/GPU (120.8% util) on 80 GB H100, GPUs Needed = 8 (TP floor), no upsize guidance | DeepSeek V3 Q4_K_M 32K TP8 disaggregated; red cell works (metric class 'bad'), sweet spot ignores util > 100% |
| IE-GAP-033 | **TGI engine model 19× pessimistic** — 80 tok/s vs vLLM 1523 at batch 8; $68.75/1M output vs $3.63 | `tgiBatchingMultiplier = min(batch/128, tokenBudget) × 0.75`; batch 8 → 6.25% × 0.75 |
| IE-GAP-034 | "KV Waste %" shows the size multiplier: 115.0% (vLLM), 120.0% (TGI) — reads as 115% waste | FORMULAS.md §15.1 contains its own self-correction about this |
| IE-GAP-035 | "MoE-Adjusted GPUs = 10" next to "GPUs Needed = 8" with EP disabled (epSize=1 default) — unexplained | EP overhead applies even with no expert parallelism |
| IE-GAP-036 | Silent quant clamp: importing quant "3.5" quietly computes at 4.5 bpw (Q4_K_M), no message | "Imported ✓", banner hidden, Model Memory 23.9 |

## What works well (no action needed)

- Engine KV-overhead factors match FORMULAS exactly (raw 1.30 / vLLM 1.15 /
  sglang 1.10 / tgi 1.20 → 47.90 / 42.37 / 40.53 / 44.21 GB ✓).
- Speculative decoding toggle: OFF → rows show "N/A (disabled)" and the input
  card hides; ON → 4,504 tok/s, 2.96× — consistent.
- Sweet spot verdicts: 4 GPUs for an 8-GPU need → "Under-provisioned: need +4
  more GPU(s)"; 16 GPUs → "Oversized: 8 spare GPU(s)".
- Multi-node scaling: 2 servers → 95.0% efficiency / 5.0% penalty (empirical
  curve); 32 GPUs PP2 → 91.4% — the CE-011 all-reduce term is computed and
  correctly tiny for compute-bound configs.
- Cloud pricing: per-provider table works (Lambda/RunPod $2.49, Vast $2.40,
  CoreWeave $2.21 per H100-80/hr — cost row updates when providers differ).
- Concurrency card flags "Bandwidth Saturated? Yes ⚠️" at 100 users.
- Zero console errors/warnings across all ~35 scenarios on both distributions.
- Board hygiene: 59/59 tasks complete with evidence; test suite meaningful
  (known-answers + poisoned-input regressions).

## Errors hit during this run (and the fixes — all driver-side, not app-side)

1. Setting a `<select>` by raw value when the option VALUES are bpw numbers
   ("4.5") instead of names ("Q4_K_M") silently blanks the select → NaN panel
   + banner. Fix: set selects by option LABEL (what a user actually picks).
   (Side note: this is exactly why IE-GAP-019's NaN fix matters — a blank
   select is a plausible real-user state.)
2. CDP `DOM.setFileInputFiles` on the app's detached file input (created,
   clicked, never appended) → "Could not find node". Fix: capture the input
   via a prototype patch, append it invisibly, then `DOM.getDocument` +
   `querySelector` + `setFileInputFiles`. The app's onchange/FileReader/
   setConfig path is untouched.
3. `Page.setInterceptFileChooserDialog` emits no `fileChooserOpened` event for
   detached inputs in headless Chrome 149 — use the capture-and-append trick.
4. Checkbox toggles need `.checked = false` + change event, not `.value`.
5. HTTP port 8123 was already serving another fleet project (NEON RUSH) —
   moved to 8199. (Serve your own port; don't assume.)

## Reproducing this run

`/tmp/dogfood-ie/` holds `cdp.js` (driver) + `s1..s7.js` (scenarios):
`node sN.js` with Chrome on `--remote-debugging-port=9223` and the repo served
on 8199. Scenario map: s1 gap-fix re-tests + worked example + new-preset math;
s2 feature deltas (disaggregated/multi-node/engines/spec/EP/pricing); s3 deep
probes (disaggregated panel, cross-node TP, TGI, spec rows); s4 forced
cross-node + util classes + spec-off + pricing table; s5 verbose cross-node
state; s6 standalone file:// build; s7 checkbox spec-off.
