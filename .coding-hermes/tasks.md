
## Dogfood Findings (2026-09-01, run #4 — verification pass)

Verdict: SHIPPABLE
Promise: This project claims a user can size an LLM inference cluster (VRAM, KV cache, GPUs needed, sweet spot, throughput, cost) in any browser — zero dependencies, no build step, two distributions (HTTP + offline standalone) — with 60 model presets, serving engines, TP/PP/MoE sharding, multi-node topology, and export/import/save/share.

This was the verification run: the six gaps filed 2026-08-22 (IE-GAP-031..036) were all marked complete by the foreman — this run re-drove each fix in a real browser (Playwright/Chromium, real DOM, real file import, real downloads, real share-link cold loads). **All six fixes CONFIRMED FIXED.** Plus a fresh-surface sweep (compare mode, SGLang radix cache, concurrency, spec+TGI, export, save/load): 21/22 checks pass, 0 console errors across ~40 scenarios on both distributions. 3 new P2 findings filed.

### Verified fixed (2026-08-22 findings)

- [x] IE-GAP-031 — Interconnect topology now changes real outputs: TP=16/2 servers forced → NVLink 2,564 vs InfiniBand 3,047 vs PCIe 2,758 tok/s; auto cross-node detection fires when a TP/PP group exceeds per-node GPUs. PP cross-node (forced) also wired: NVLink 10,780 (×1.19) vs PCIe 11,594 (×1.10).
- [x] IE-GAP-032 — Disaggregated 96.6 GB/GPU (120.8% util) now reads "Does not fit on H100 80GB: 120.8% util — 96.6 GB/GPU > 80 GB. Raise TP/PP, reduce context/batch, or use a larger GPU" instead of "Tight fit".
- [x] IE-GAP-033 — TGI engine now 1.76× below vLLM at batch 8 (863 vs 1,523 tok/s; $6.41 vs $3.63 /1M) via smoothstep occupancy curve — was 19×.
- [x] IE-GAP-034 — Label is now "KV size vs raw % (CE-007)" showing "+15%" (the multiplier), not "KV Waste 115.0%".
- [x] IE-GAP-035 — EP at epSize=1 no longer adds phantom GPUs: MoE-Adjusted GPUs = GPUs Needed = 8.
- [x] IE-GAP-036 — Import of quant "3.5" now shows status `quant "3.5" not supported — using Q4_K_M (~4.5 bpw) · Imported ✓` AND a visible dismissible banner; results finite at clamped 4.5 bpw.

### New findings (filed as board tasks)

- [P2] IE-GAP-045 — Compare pane (pane B) ignores PP cross-node in its topology penalty — `paneRecalculate` gates on `tpIsCrossNode` only; main pane uses `tpIsCrossNode || ppIsCrossNode`. Same config: main pane penalty ×1.19, compare pane ×1.00.
- [P2] IE-GAP-046 — Cross-node penalty is bandwidth-RATIO-based: InfiniBand (inter = intra, 1:1) pays ×1.00 — a uniformly slow fabric is modeled as free. Documented formula (FORMULAS §19.2), unexamined consequence.
- [P2] IE-GAP-047 — Disaggregated "Does not fit" verdict doesn't recompute at the new TP: raise TP 8→16 and the verdict still says 120.8% / 96.6 GB/GPU while GPUs Needed correctly changes 8→16.

Also re-confirmed from the morning run (DF-INFERENCE-ESTIMATOR-1..3, all still valid): port 8000 busy on this host; docs labels differ slightly from dropdown labels; file:// embedded-fallback notice is console-only.

### Fresh-surface checks that PASSED (no action)

Preset applies real fields (DeepSeek V3 → 671B/61 layers + description card); share-link cold load restores full state; Export JSON downloads a real 60-key file; Save/Load localStorage roundtrip; Compare mode opens pane B; SGLang radix-cache fields live (30% hit → KV 40.53 GB, 1,981 tok/s); 1,000-user concurrency finite (p50 7,993 ms, saturated ⚠️); TGI+spec-decode finite (2,552 tok/s, 2.96×); 1M-context and custom-1000GB-GPU extremes finite; IQ2_XXS (20.3 GB) and FP32 (324.8 GB) quant extremes finite.
