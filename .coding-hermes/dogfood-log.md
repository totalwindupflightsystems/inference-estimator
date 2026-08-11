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
- **Left behind:** docs/dogfood/2026-08-11-integration.md,
  docs/dogfood/diagnostics.md, skills/inference-estimator-usage/SKILL.md,
  board tasks IE-GAP-019..022 (+ events.jsonl provenance).
- **Foreman:** cooldown 900s (not paused) — no wake needed; 4 pending tasks
  added for the next tick.
