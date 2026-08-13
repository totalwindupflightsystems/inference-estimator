---
name: inference-estimator-usage
description: >-
  How to use the Inference Cluster Estimator (single-file HTML GPU cluster
  sizing tool) for real: entry points, run commands, the worked example,
  persistence/share workflows, and the pitfalls that produce silent NaN
  results. Load this skill before field-testing or extending the project.
version: 1.0.0
category: software-development
---

# Inference Estimator — Usage Skill

GPU cluster sizing estimator: model params + quantization + context → VRAM,
KV cache, GPUs needed, sweet spot. Single-file static HTML, zero deps, no
build step. 42 model presets (MoE + dense), GPU specs (H100/H200/B200/A100/
L40S/MI300X/RTX6000/custom), serving engines (vLLM/SGLang/TGI), TP/PP, MoE
expert placement, NVLink/InfiniBand topology, speculative decoding,
concurrency modeling, cloud + API pricing, breakeven analysis.

## Entry points

| What | Where |
|---|---|
| Main tool (live model library) | `cluster-estimator.html` — serve over HTTP |
| Offline single-file build | `dist/inference-estimator-standalone.html` — double-click from `file://`, identical numbers |
| Model data | `models/*.json` (42 files + `index.json`), fetched at runtime; embedded fallback baked into the HTML |
| Regression harness | `test.js` (jsdom) — `npm install && npm test`, 5 groups ~1.3s |
| Worked-example replication | `docs/example-calc.js` — `node docs/example-calc.js` |
| Docs | `docs/QUICKSTART.md` (5-step + full worked example), `docs/FORMULAS.md`, `docs/GLOSSARY.md` |
| Task board | `.coding-hermes/board/tasks.jsonl` (JSONL v2 rows; `events.jsonl` for provenance) |

## Run it

```bash
python3 -m http.server 8000        # from repo root
# open http://localhost:8000/cluster-estimator.html
npm test                            # regression harness
node docs/example-calc.js           # prints the worked example with all intermediates
```

## The worked example (use as your smoke test)

DeepSeek V3 preset → Q4_K_M (4.5), KV FP16, ctx 32,768, batch 8, overhead 15%,
H100-80, 8/server, 1 server, monolithic, TP=8, PP=1, vLLM, Lambda → expect:
**Model Memory 23.9 GB · KV Cache 42.37 GB · VRAM/GPU 59.6 GB · GPUs Needed 8
· Util 74.4% · Decode 1,523 tok/s · Prefill 80,865 tok/s · $19.92/hr ·
Breakeven 26.4B tok/mo · "Tight fit — no headroom"**. If any of these drift,
the math or the preset data broke (see diagnostics.md — known-answer tests
catch this).

## Real-use workflows (all verified 2026-08-11 in a real browser)

1. **Sizing**: pick preset → set quant/ctx/batch → pick GPU + TP/PP →
   read Results (updates instantly). Presets fill model fields but NOT
   quantization — set it explicitly.
2. **Persistence**: "Save to Browser" (localStorage, survives reload),
   "Load Saved", "Export JSON" (real file download), "Import JSON" (file
   picker, real `importConfig()` path).
3. **Share**: "🔗 Copy Link" → base64 config in the URL hash → opening the
   link in ANY browser (fresh load) restores the config; the hash also
   overrides a previously saved config. Note the URL hash auto-updates
   (~500ms debounce) as you edit — that's the share-current-state mechanism.
4. **Compare**: "⚖ Compare" toggles dual panes; copy config between A/B.

## Pitfalls (learned the hard way)

- **Blank/invalid quantization = silent NaN.** `recalculate()` has no
  fallback on the `#quant` select. Importing a config with a quant value
  that isn't in the option list (e.g. `"3.5"`), or opening a share link with
  `quant:""`, blanks the select and the Results panel fills with NaN —
  no error message anywhere. Workaround: re-pick a valid quantization.
  Fix tracked as IE-GAP-019 (board).
- **Preset dropdown is empty after restore** (share link / import): fields
  restore, but `#modelPreset` shows "-- Select preset --" — numbers are
  correct; the dropdown state isn't part of the config (IE-GAP-020).
- **Selecting a preset does not touch quantization** — the select keeps its
  previous value (default 4.5 on fresh load). This is by design; don't
  "fix" it by clearing the select — that triggers the NaN pitfall above.
- **`dist/` is gitignored** — after changing the HTML or models, regenerate
  the standalone: `node scripts/build-standalone.js && node scripts/verify-standalone.js`.
- **file:// on the non-standalone HTML** uses embedded fallback presets only
  (console warning). For offline use open the standalone build.

## Automating tests against the real page

Use headless Chrome + CDP (see `.coding-hermes/dogfood/2026-08-11-integration.md`).
Test-driver traps: `/json/new` may reuse an existing tab (force a fresh
document: navigate to `about:blank` first, or add a unique query param);
`localStorage.clear()` must run on the target origin; the debounced hash
rewrite means capture share links ≥700ms after the last edit; assigning an
unknown value to a `select.value` silently blanks it.
