# Dogfood Log — inference-estimator

## 2026-08-11 — SHIPPABLE with caveats (real-browser field test)

- **Promise:** "Model params + quantization + context → VRAM, KV cache, GPUs
  needed, sweet spot" — single-file HTML cluster sizing tool with 42 model
  presets, export/import/save/share, standalone offline build.
- **Method:** headless Chrome 149 driven via CDP (15 scenarios, real DOM/JS,
  real downloads, real clipboard, real localStorage, cold loads). Ran the
  QUICKSTART worked example, all persistence/share/compare/theme features,
  both distributions, 1M-context and custom-GPU extremes, and a poisoned-
  import + share-link attack pair.
- **Verdict:** SHIPPABLE with caveats. Every promised number reproduced
  exactly (23.9/42.37/59.6/8/74.4%/1523/$19.92/26.4B); all 42 presets load;
  export/import/save/share/compare/theme all work; standalone file:// build
  identical and offline; zero console errors across all scenarios; test
  suite 5/5 in 1.3s.
- **Top 3 findings:**
  1. P1 — invalid/missing quant silently produces NaN Results (via import of
     a config with an out-of-list quant, or a share link with blank quant);
     IE-GAP-013's "poisoned-import finiteness" doesn't cover quant. → IE-GAP-019
  2. P2 — preset selection not serialized: restored configs (share link /
     import) leave the Preset dropdown empty. → IE-GAP-020
  3. P2 — no validation UX (silent NaN, no hint) and test.js never exercises
     the two real user workflows (hash cold load, real file import). → IE-GAP-021/022
- **Time-to-first-success:** ~3 min (load page → pick preset → set quant/
  GPU → read results); full worked example setup incl. doc reading ~15 min.
  Friction count: 3 real frictions (NaN vector, preset-dropdown gap, no
  validation messaging) + several test-driver artifacts (tab reuse, wrong-
  origin localStorage.clear, debounce lag).
- **Left behind:** .coding-hermes/dogfood/2026-08-11-integration.md,
  .coding-hermes/dogfood/diagnostics.md, skills/inference-estimator-usage/SKILL.md,
  board tasks IE-GAP-019..022 (+ events.jsonl provenance).
- **Foreman:** cooldown 900s (not paused) — no wake needed; 4 pending tasks
  added for the next tick.

## 2026-08-22 — SHIPPABLE with caveats (real-browser field test #2)

- **Promise:** "Model params + quantization + context → VRAM, KV cache, GPUs
  needed, sweet spot" — single-file HTML cluster sizing tool; 60 model presets,
  engines, TP/PP/EP, interconnect topology, disaggregated serving, pricing,
  export/import/save/share/compare, offline standalone build.
- **Method:** headless Chrome 149 via CDP, 35+ scenarios across 7 scripts.
  Re-ran the QUICKSTART worked example on both distributions; re-tested the
  2026-08-11 gap fixes (IE-GAP-019..022) via real file import + share-link cold
  load; hand-checked new-preset math (GPT-OSS-120B); deep-probed the surface
  the last run never touched (disaggregated, multi-node interconnect, engine
  comparison, EP, spec toggle, providers).
- **Verdict:** SHIPPABLE with caveats. Worked example byte-exact on HTTP AND
  file:// standalone (23.9/42.37/59.6/8/74.4%/1523/80865/$19.92/26.4B); all
  four 08-11 gaps verified FIXED; 60/60 presets load; zero console errors
  anywhere; npm test 10/10 in 3.1s.
- **Top 3 findings (new surface, all filed):**
  1. P1 — interconnect topology (CE-010) is inert: auto cross-node detection
     never fires (tpFitsNode formula wrong) and even forced, the ×1.19 penalty
     changes no computed result. → IE-GAP-031
  2. P1 — disaggregated mode reports infeasible configs (96.6 GB/GPU = 120.8%
     util on 80 GB H100) as "Tight fit", GPUs Needed = 8 (TP floor). → IE-GAP-032
  3. P1 — TGI engine model is 19× pessimistic (80 tok/s vs vLLM 1523 at batch
     8; $68.75/1M vs $3.63) — engine comparison materially misleading. → IE-GAP-033
  Plus P2: "KV Waste %" shows size multiplier 115.0% (IE-GAP-034), "MoE-Adjusted
  GPUs = 10" with EP disabled (IE-GAP-035), silent quant clamp on import
  (IE-GAP-036).
- **Time-to-first-success:** ~2 min (load → preset → quant → results).
  Friction count: 3 real model/UX gaps + 3 display issues (see tasks).
- **Left behind:** .coding-hermes/dogfood/2026-08-22-integration.md,
  .coding-hermes/dogfood/2026-08-22-diagnostics.md, SKILL.md updated to v1.1.0
  (stale NaN pitfalls corrected, new pitfalls documented), board tasks
  IE-GAP-031..036 + dogfood event 269.
- **Foreman:** NOT woken — cooldown 21600s is a documented fleet.toml pin
  (audits #254-258: "NO PUT"); registration healthy (namespace_id
  coding-hermes, enabled, no zombies). 6 pending tasks wait for the next
  scheduled tick (~6h cadence).
2026-09-01 | SHIPPABLE | 20s t2fs | friction 4 | 3 findings

## 2026-09-01 (run #4, ~17:30) — SHIPPABLE (verification pass, real browser)

- **Promise:** unchanged (single-file HTML cluster sizing, 60 presets, two
  distributions, zero deps).
- **Method:** the check the foreman's own tests can't do — all six 08-22
  findings (IE-GAP-031..036), marked complete on the board, were re-driven in
  Playwright/Chromium: real file import, real downloads, real share-link cold
  loads, both distributions. Plus fresh surface: compare mode, SGLang radix,
  1,000-user concurrency, TGI+spec, export, save/load, 1M-ctx / 1000-GPU /
  IQ2_XXS / FP32 extremes.
- **Verdict:** SHIPPABLE. **All six fixes CONFIRMED FIXED** (topology changes
  decode tput 2,564→3,047→2,758 across NVLink/IB/PCIe, PP path wired;
  disagg infeasible reads "Does not fit…Raise TP/PP"; TGI ratio 1.76× not
  19×; KV label "+15%"; EP@1 = 8=8; clamp status + visible banner on import
  of quant "3.5"). Worked example byte-exact on both distributions (23.9 /
  42.37 / 59.6 / 8 / 74.4% / 1523 / 80865 / $19.92 / 26.4B); 21/22 fresh
  checks pass; 0 console errors.
- **Top 3 findings (new, all P2, filed):**
  1. IE-GAP-045 — compare pane ignores PP cross-node (tpIsCrossNode-only gate).
  2. IE-GAP-046 — cross-node penalty is ratio-based: 1:1 InfiniBand = free.
  3. IE-GAP-047 — disagg "Does not fit" verdict doesn't recompute at new TP.
- **Time-to-first-success:** ~20 s. Friction count: 3 (filed above) + 4
  driver artifacts (preset labels, toFixed display, download race, detached
  import input — documented in docs/dogfood/2026-09-01-verification.md).
- **Left behind:** docs/dogfood/2026-09-01-verification.md, board tasks
  IE-GAP-045..047, dogfood event 308, tasks.md rewritten, SKILL.md v1.2.0.
- **Foreman:** NOT woken — cooldown 21600s is the documented fleet pin
  (audits #254-258: NO PUT); foreman was actively ticking during this run and
  3 fresh pending tasks await it.

2026-09-04 | SHIPPABLE | 30s t2fs | friction 4 | 5 findings

