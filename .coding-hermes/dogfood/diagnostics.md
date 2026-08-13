# Inference Estimator — Diagnostics Trail (2026-08-11 dogfood)

How the tool is built, why, the errors encountered during a real-browser field
test, and the right way to work on it. Written by the 2026-08-11 dogfood run;
this is the "explained lessons" record, not raw logs.

## How it's built

- **One file, three layers.** `cluster-estimator.html` (~2,600 lines) is HTML +
  CSS + a single inline `<script>`: UI wiring (inline `onclick`/`onchange`
  attributes — old-school, no framework), a `recalculate()` math core, and a
  config persistence layer. No build step, no dependencies, no framework.
- **Model data is external + embedded.** `models/*.json` (42 files + index)
  are fetched at runtime (`loadModelLibrary()`, async); a full fallback copy
  is embedded in the HTML for `file://` use. `dist/inference-estimator-
  standalone.html` is a generated build with everything inlined (regenerate
  with `node scripts/build-standalone.js`).
- **The math core** (`recalculate()`, ~line 1183): pure functions over DOM
  field values. Key formulas: model memory = params × bpw/8 (MoE: active
  params) × (1+overhead); KV cache = 2×layers×KV-heads×head-dim×(kvBpw/8) ×
  ctx × batch /1e9 × engine KV-waste; per-GPU = total/TP + KV/TP (or all KV
  on prefill GPUs when disaggregated); gpusNeeded = max(ceil(vram/(0.9×gpu)),
  TP×PP). Throughput = memory bandwidth / (active params × bpw/8 / TP),
  divided by batch efficiency; cost = cloud price × gpus; breakeven = monthly
  GPU cost / API output price per token.
- **State model:** every field has an id; `getConfig()`/`setConfig(cfg)`
  serialize/restore them; a **500ms-debounced `encodeConfigToHash()`** keeps
  the URL hash in sync with the current config (this is why the URL always
  has a base64 hash — it's the "share current state" mechanism), and
  `decodeHashToConfig()` runs on load + `hashchange`. Order on load: defaults
  → `recalculate()` → saved-config restore → **hash decode (wins)** →
  async model-library load (which re-runs UI refresh but does NOT reset
  fields).
- **Regressions:** `test.js` (jsdom + a fetch polyfill serving the real
  `models/` JSONs) — 5 groups, runs in ~1.3s.

## Errors encountered during the run (mine AND the code's)

1. **NaN leakage on invalid `#quant` (the big one).** `recalculate()` line
   ~1187 reads `parseFloat(document.getElementById('quant').value)` with **no
   fallback**, while every other numeric input uses `parseFloat(...) || def`.
   Real-browser proof: import a config with `quant:"3.5"` (valid JSON, invalid
   option) → the select blanks (spec behavior: assigning an unknown value to
   `select.value` deselects everything) → Results render `NaN Model Memory`,
   `NaN GPUs Needed`, `$NaN/hr`, "need +NaN more GPU(s)". The same happens to
   a share-link recipient when the hash contains `quant:""`. The board claims
   IE-GAP-013 "poisoned-import finiteness" is complete, but its regression
   only poisons tpSize/NaN/Infinity — the quant field was never covered.
   **Right way:** guard with `|| 4.5` (or a validation banner), and add a
   poisoned-quant case to the GAP group in test.js.
2. **Preset not part of the config.** `getConfig()` never writes the preset
   key, so restore paths set raw fields but leave `#modelPreset` on
   "-- Select preset --". Cosmetic (numbers are right) but breaks the
   QUICKSTART promise of "your exact configuration" and the API-pricing
   active highlight.
3. **Test-harness blind spots.** test.js only does in-memory
   `getConfig → JSON → setConfig` roundtrips. The two documented workflows a
   user actually performs — opening a share link (hash cold load) and picking
   a file in Import JSON — are untested. That's why 5/5 green coexists with
   both gaps above.
4. **Test-driver pitfalls (mine, for future dogfood runs):** (a) Chrome's
   `/json/new` with an already-open URL can return an EXISTING tab — always
   force a fresh document (navigate `about:blank` → target, or append a
   unique query param) or you will "verify" stale state; (b) `localStorage`
   cleared from an `about:blank` context clears the WRONG origin's storage —
   clear while on the target origin; (c) a debounced hash rewrite (~500ms)
   means the URL you read right after a change may lag one recalculate
   behind — wait ≥700ms before capturing share links; (d) setting
   `select.value` to a non-existent option silently blanks the select (this
   is what made my own invalid-quant test inputs poison state).

## The right way to work on this project

- **Verify math changes against the QUICKSTART worked example** (23.9 /
  42.37 / 59.6 / 8 / 74.4% / 1523 / $19.92 / 26.4B). `docs/example-calc.js`
  replicates `recalculate()` standalone; `npm test` asserts the known
  answers. If a formula changes, update all three (HTML, example-calc.js,
  QUICKSTART) or the docs drift.
- **Never leave a numeric field without a fallback.** The codebase pattern is
  `parseFloat(el.value) || <default>` — a missing `||` on any new field will
  produce silent NaN (see error #1).
- **Config format is the contract.** `getConfig()`/`setConfig()`/hash/export/
  import all share it. Add any new field to getConfig + setConfig + the label
  updates, and keep it backward-compatible (setConfig must tolerate missing
  keys — it does via the loop + `||` label defaults).
- **After changing `cluster-estimator.html` or `models/`, regenerate the
  standalone build** (`node scripts/build-standalone.js`, then
  `node scripts/verify-standalone.js`) — `dist/` is gitignored, so forgetting
  this silently ships a stale offline build.
- **Model presets carry no quantization** by design; if you add one, it must
  be a value present in the `#quant` option list, or preset application will
  blank the select (spec behavior) and hit error #1.
- **Serving it:** `python3 -m http.server` from the repo root; the tool
  fetches `models/*.json` relative to the page. The board/scheduler service
  runs on 127.0.0.1:9090 (do not confuse with the http.server port).
