---
name: inference-estimator-usage
description: >-
  How to use the Inference Cluster Estimator (single-file HTML GPU cluster
  sizing tool) for real: entry points, run commands, the worked example,
  persistence/share workflows, and current modeling caveats. All six 08-22
  gaps (IE-GAP-031..036) were verified FIXED by real-browser re-drive on
  2026-09-01; residual P2s are IE-GAP-045..047 (compare-pane PP cross-node,
  ratio-based cross-node penalty, disagg verdict not recomputing at new TP).
  Load this skill before field-testing or extending the project.
version: 1.2.0
category: software-development
---

# Inference Estimator — Usage Skill

GPU cluster sizing estimator: model params + quantization + context → VRAM,
KV cache, GPUs needed, sweet spot. Single-file static HTML, zero deps, no
build step. 60 model presets (MoE + dense), GPU specs (H100/H200/B200/A100/
L40S/MI300X/RTX6000/custom), serving engines (vLLM/SGLang/TGI), TP/PP, MoE
expert placement, NVLink/InfiniBand topology, speculative decoding,
concurrency modeling, cloud + API pricing, breakeven analysis.

## Entry points

| What | Where |
|---|---|
| Main tool (live model library) | `cluster-estimator.html` — serve over HTTP |
| Offline single-file build | `dist/inference-estimator-standalone.html` — double-click from `file://`, identical numbers |
| Model data | `models/*.json` (60 files + `index.json`), fetched at runtime; embedded fallback baked into the HTML |
| Regression harness | `test.js` (jsdom) — `npm install && npm test`, 10 groups ~3.1s |
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

## Real-use workflows (verified 2026-08-11 and re-verified 2026-08-22 in a real browser)

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

### Status after 2026-09-01 verification run (all six 08-22 gaps FIXED — re-driven in a real browser)

- **Interconnect topology is wired** (IE-GAP-031 fixed): a TP/PP group whose
  SIZE exceeds `gpusPerServer` (or a forced policy) triggers a cross-node
  penalty ÷ into decode throughput — NVLink/InfiniBand/PCIe choices change
  real outputs. Residual (IE-GAP-046): the penalty is RATIO-based
  (1 + log10(intra/inter)×0.15), so InfiniBand (inter = intra) pays ×1.00 —
  model a uniformly slow fabric's cost yourself. Residual (IE-GAP-045): the
  Compare pane's penalty still ignores PP cross-node.
- **Disaggregated infeasibility is explicit** (IE-GAP-032 fixed): >100% util
  reads "Does not fit on <GPU>: X% util — Y GB/GPU > Z GB. Raise TP/PP…" —
  but the verdict's numbers do NOT recompute after you raise TP (IE-GAP-047);
  re-check util after changing parallelism.
- **TGI numbers are sane** (IE-GAP-033 fixed): 863 tok/s / $6.41 per 1M vs
  vLLM 1,523 / $3.63 at batch 8 (1.76×) — safe to compare engines directly.
- **"KV size vs raw % (CE-007)" shows the size multiplier** (IE-GAP-034
  fixed): +15% = vLLM's overhead factor, not 15% waste.
- **MoE-Adjusted GPUs equals GPUs Needed at epSize=1** (IE-GAP-035 fixed).
- **Out-of-list quant on import/share is loud** (IE-GAP-036 fixed): status
  shows `quant "3.5" not supported — using Q4_K_M (~4.5 bpw)` AND a dismissible
  banner appears; results compute at the clamped 4.5 bpw. Blank quant keeps
  its own banner. If numbers don't match an exported JSON, check the quant
  select anyway.
- **Preset selection does not touch quantization** — the select keeps its
  previous value (default 4.5 on fresh load). By design; don't "fix" it by
  clearing the select.
- **`dist/` is gitignored** — after changing the HTML or models, regenerate
  the standalone: `node scripts/build-standalone.js && node scripts/verify-standalone.js`.
- **file:// on the non-standalone HTML** uses embedded fallback presets only
  (console warning only when offline — no visible notice when online;
  DF-INFERENCE-ESTIMATOR-3 open). For offline use open the standalone build.

## Automating tests against the real page

Use Playwright (`node_modules/playwright`, chromium already installed) or raw
CDP (see `.coding-hermes/dogfood/2026-08-11-integration.md`; the 2026-09-01
verification report's "Runner notes" has the current trap list). Traps:
preset `<option>`s are runtime-populated — match by VALUE (`deepseek-v3`),
not label; decode/prefill render `toFixed(0)` ("1523", not "1,523"); export
needs `waitForEvent('download')` raced with the click; the import file input
is detached — patch `HTMLInputElement.prototype.click` to append it, then
`setInputFiles`; `/json/new` may reuse an existing tab (navigate to
`about:blank` first, or add a unique query param); `localStorage.clear()`
must run on the target origin; the debounced hash rewrite means capture
share links ≥700ms after the last edit; assigning an unknown value to a
`select.value` silently blanks it.
