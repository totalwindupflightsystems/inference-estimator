# Inference Estimator — Dogfood Verification Report (2026-09-01, run #4)

Fourth real-use run; first **verification pass**: every fix the foreman shipped
against the 2026-08-22 findings (IE-GAP-031..036) was re-driven in a real
browser. Method identical to prior runs: Playwright/Chromium headless, real
DOM interaction (selects by option label/value, real file import via
capture-and-append, real download events, real share-link cold loads in a
fresh page), both distributions, zero console/page errors across ~40 scenarios.

## Verdict: SHIPPABLE

The 08-22 verdict's "caveats" were exactly the six findings below. All six are
now fixed **and verified fixed by independent re-drive** — this is the L3
(it-works-for-a-user) check the foreman's own green tests can't provide.

## The six 08-22 fixes — re-driven in a real browser

| Fix | How it was re-tested | Result |
|---|---|---|
| IE-GAP-031 (topology inert) | TP=16 / 2×8 H100, switch NVLink→InfiniBand→PCIe; then forced PP cross-node (TP=2/PP=2, policy cross-node) | **FIXED** — decode tput now varies with topology (2,564 / 3,047 / 2,758 tok/s); auto-detection fires when TP/PP group > per-node GPUs; PP path wired (10,780 ×1.19 vs 11,594 ×1.10) |
| IE-GAP-032 (infeasible reads "Tight fit") | DeepSeek V3 Q4_K_M 32K batch 8 disaggregated TP=8 | **FIXED** — "Does not fit on H100 80GB: 120.8% util — 96.6 GB/GPU > 80 GB. Raise TP/PP, reduce context/batch, or use a larger GPU" (but see IE-GAP-047) |
| IE-GAP-033 (TGI 19× pessimistic) | Same config, engine vLLM vs TGI | **FIXED** — TGI 863 tok/s / $6.41 per 1M vs vLLM 1,523 / $3.63 (1.76× ratio; smoothstep occupancy curve replaced linear batch/128 multiplier) |
| IE-GAP-034 ("KV Waste 115%") | Read metric label + value under vLLM | **FIXED** — label "KV size vs raw % (CE-007)", value "+15%" |
| IE-GAP-035 (MoE-Adjusted GPUs 10≠8) | DeepSeek V3 (MoE), EP off | **FIXED** — MoE-Adjusted GPUs = GPUs Needed = 8 at epSize=1 |
| IE-GAP-036 (silent quant clamp) | Real file import `{quant: "3.5"}` via the app's own Import button | **FIXED** — status `quant "3.5" not supported — using Q4_K_M (~4.5 bpw) · Imported ✓` + visible dismissible banner; numbers finite at 4.5 bpw |

## Worked example — still byte-exact (regression)

DeepSeek V3 preset (selected by value `deepseek-v3`: fills 671B/37B active, 61
layers, description card) → Q4_K_M, KV FP16, 32,768 ctx, batch 8, 15% OH,
8×H100-80, TP=8, vLLM, Lambda — on HTTP **and** standalone file:// (presets=61
options embedded, no network):

Model Memory **23.9** · KV **42.37** · VRAM/GPU **59.6** · GPUs **8** · Util
**74.4%** · Decode **1523 tok/s** · Prefill **80865 tok/s** · **$19.92/hr** ·
Breakeven **26.4B** · "Tight fit — no headroom". (Note: decode/prefill render
un-grouped since the 08-22 report — `toFixed(0)`, no `toLocaleString` — same
number, different formatting; share-link cold load restores the full state.)

## Fresh surface swept this run (21/22 checks pass)

- Preset apply (fields + description card) ✓ · share-link cold load ✓ ·
  Export JSON real download (60 keys) ✓ · Save/Load roundtrip ✓ ·
  Compare mode opens pane B ✓ · SGLang radix cache live (30% hit → KV 40.53,
  1,981 tok/s) ✓ · 1,000-user concurrency finite + "Bandwidth Saturated ⚠️" ✓ ·
  TGI+spec-decode (2,552 tok/s, 2.96×) ✓ · 1M ctx / custom 1000 GB GPU
  extremes finite ✓ · IQ2_XXS 20.3 GB / FP32 324.8 GB ✓.
- Only failure was the C6 driver check itself (my regex matched the topology
  description text, and PP=2 on 4-GPU servers doesn't cross) — re-tested
  properly via drive4: wired for TP and PP in the main pane. Two real P2s
  fell out of this probe: **IE-GAP-045** (compare pane skips PP cross-node),
  **IE-GAP-046** (ratio-based penalty models a 1:1 slow fabric as free).

## New findings filed (all P2, none block real use)

1. **IE-GAP-045** — pane B topology penalty ignores PP cross-node
   (`tpIsCrossNode`-only gate at ~L2632 vs main pane `||` at ~L1481).
2. **IE-GAP-046** — penalty = 1 + log10(intra/inter)×0.15 → InfiniBand 1:1
   ratio costs nothing; absolute fabric speed unmodeled (documented in
   FORMULAS §19.2, consequence unexamined).
3. **IE-GAP-047** — disaggregated infeasible verdict lags a TP change
   (verdict numbers stay at TP=8's 120.8%/96.6 GB after TP→16).

## Runner notes for the next dogfood (driver-side, not app bugs)

- Preset `<option>`s are runtime-populated from `MODEL_PRESETS`/`models/` —
  match by VALUE (`deepseek-v3`), labels like "DeepSeek V3 " don't exist.
- The worked-example defaults equal a fresh page's defaults — prove preset
  selection separately (check `#params`=671, `#nLayers`=61) or you've tested
  nothing.
- Decode/prefill display is `toFixed(0)` — expect "1523", not "1,523".
- Export download needs `waitForEvent('download')` + click in
  `Promise.all` (anchor click is synchronous).
- The import file input is detached (created, clicked, never appended):
  patch `HTMLInputElement.prototype.click`, append it, then
  `setInputFiles` — unchanged from 08-22's notes.
- ppCrossNode/tpCrossNode "auto" only flags cross-node when the group SIZE
  exceeds `gpusPerServer` — a PP=2 group on 4-GPU servers is intra-node by
  design (FORMULAS §19.2).
