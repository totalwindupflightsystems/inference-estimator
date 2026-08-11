# Inference Estimator — Dogfood Integration Report (2026-08-11)

Real-use field test in headless Chrome (Chrome 149, CDP-driven, real DOM/JS — no
test-harness shortcuts). Verdict: **SHIPPABLE with caveats** — the core promise
holds and every documented workflow verified, with two real gaps (see
IE-GAP-019/020 on the board).

## What the tool claims (Promise)

> "Model params + quantization + context → VRAM, KV cache, GPUs needed, sweet
> spot analysis" — a single-file HTML tool that lets an engineer size an LLM
> inference cluster in a browser with zero dependencies. 42 model presets, GPU
> specs, serving engines (vLLM/SGLang/TGI), TP/PP sharding, MoE, speculative
> decoding, concurrency modeling, cloud+API pricing, export/import/share/
> save/compare. Two distributions: `cluster-estimator.html` (live model
> library over HTTP) and `dist/inference-estimator-standalone.html` (offline,
> double-click from `file://`).

## How to use it for real (verified working)

1. Serve the repo: `python3 -m http.server 8000` → open
   `http://localhost:8000/cluster-estimator.html`. (For air-gapped use, open
   `dist/inference-estimator-standalone.html` directly — identical results.)
2. Pick a preset (43 options: 42 models + placeholder). Presets fill
   params/arch/layers/KV heads/head dim/hidden size but **not** quantization —
   set Quantization explicitly (default is Q4_K_M ~4.5 bpw).
3. Set context/batch/overhead, GPU model, TP/PP, serving engine. Results panel
   updates instantly (also via the debounced URL hash, ~500ms).
4. Persistence: "Save to Browser" (localStorage) survives reload; "Export
   JSON" downloads `cluster-config.json`; "Import JSON" opens a file picker
   and restores; "🔗 Copy Link" puts a full URL with a base64 config hash on
   the clipboard — **cold-loading that link in any browser restores the
   config** (verified: fields restore at ~150ms after load and stay stable
   through model-library load; hash also overrides a previously saved config,
   as coded).

## Worked example — verified byte-for-byte

DeepSeek V3, Q4_K_M, FP16 KV, 32,768 ctx, batch 8, 15% overhead, 8×H100-80,
TP=8/PP=1, vLLM, Lambda pricing (QUICKSTART.md steps 1–5):

| Metric | Promised | Measured in real browser |
|---|---|---|
| Model Memory | 23.9 GB | 23.9 ✓ |
| KV Cache | 42.37 GB | 42.37 ✓ |
| VRAM / GPU | 59.6 GB | 59.6 ✓ |
| GPUs Needed | 8 | 8 ✓ (TP×PP floor) |
| GPU Utilization | 74.4% | 74.4% ✓ |
| Decode Throughput | 1,523 tok/s | 1,523 ✓ |
| Prefill Throughput | 80,865 tok/s | 80,865 ✓ |
| Est. Cost/hr | $19.92 | $19.92 ✓ |
| Breakeven | 26.4B tok/mo | 26.4B ✓ |
| Sweet Spot | Tight fit — no headroom | ✓ |

Every number in QUICKSTART.md reproduced exactly. `node docs/example-calc.js`
(independent replication) agrees. Second scenario (Llama 3.3 70B on 4×A100-80,
8K ctx, batch 16) hand-checked: 45.7 GB model, 49.39 GB KV, 23.8 GB/GPU,
240 tok/s decode — all consistent with the formulas. 1M-context extreme and
custom-GPU (96 GB) also finite and plausible.

## Feature matrix (all exercised in the real browser)

| Feature | Result |
|---|---|
| 42 presets from live `models/` library | ✓ (43 dropdown options; console shows "Loaded 42 models") |
| Standalone `file://` offline build | ✓ identical numbers, zero network, zero console errors |
| Export JSON | ✓ real download, valid JSON, correct fields |
| Import JSON (real `importConfig()` file path) | ✓ restores gpu/tp/ctx/quant for valid configs |
| Save to Browser + reload | ✓ localStorage `cluster-estimator-config` survives reload |
| Load Saved | ✓ |
| Share link (hash) cold load | ✓ config restored, overrides saved config |
| Compare mode | ✓ dual panes (A/B) with copy-between buttons |
| Theme toggle | ✓ background + button label flip |
| Edge: 0 GPUs, FP32, 1M ctx, TP/PP floor, cloud fallback | ✓ finite, sane |
| Browser console errors during any scenario | none |

## Errors hit and their fixes

1. **NaN Results panel after importing a config with invalid/missing quant**
   (e.g. `quant: "3.5"`, which is not an option value). The select is blanked
   and Model Memory / VRAM / GPUs / cost all render `NaN` — no error, no
   warning. Same via a share link whose config carries `quant: ""`.
   → Board task **IE-GAP-019** (P1): add the `|| fallback` guard on `quantBpw`
   that every other field has; extend the poisoned-import regression test.
2. **Preset dropdown empty after share-link/import restore.** Fields restore,
   but `#modelPreset` shows "-- Select preset --" because `getConfig()` never
   serializes the preset key. → Board task **IE-GAP-020** (P2).
3. **No validation UX** — silent NaN instead of a hint (related to #1).
   → Board task **IE-GAP-021** (P2).
4. **test.js misses both paths above** (in-memory roundtrip only).
   → Board task **IE-GAP-022** (P2).

## Notes for the maintainer (1-hour priority order)

1. Guard `quantBpw` (`parseFloat(...) || 4.5`) — one line, kills the NaN
   class of bugs including the share-link vector.
2. Add a Results-panel validation banner for non-finite inputs.
3. Include the preset key in the config so restored state is fully faithful.
4. Add the two missing regression paths to test.js (hash cold-load, real
   importConfig with poisoned quant).

## Reproducing this run

All scenarios drove the real page in headless Chrome via CDP
(`/tmp/dogfood-ie/cdp.js` + `s1..s15` scenario scripts). The definitive
share-link test: build config → Copy Link → `location.href = shareUrl` →
poll fields; restore happens ~150ms after load and persists.
