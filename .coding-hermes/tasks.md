
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

## Dogfood Findings (2026-09-04)
Verdict: SHIPPABLE
Promise: {"entry_point":"cluster-estimator.html — a single-file static HTML web app (HTML+CSS+JS in one file, dark theme, runs in any browser; also embeddable via iframe and shareable via base64-JSON URL hash); no CLI binary, no server, no library, no MCP.","promise":"This project claims a user can size an L

- [P1] npm test hard-fails on stale CHANGELOG gate, short-circuiting the browser leg — IE-CI-001 deliberately red: on a fresh clone whose newest commit (2026-09-04) is newer than the newest changelog entry (2026-08-27), 
> inference-estimator@1.0.0 test
> node test.js && node test-browser.js

PASS  Presets: 60/60 presets valid 0 NaN
PASS  Roundtrip: JSON export/import lossless (60 fields)
PASS  Edge cases: 0-GPUs finite; 1B-params finite; FP32 finite; 1M-ctx finite
PASS  GAP regressions: PASS TP floor: TP=8 PP=1 → GPUs Needed=8; PASS Cloud fallback warning: warn visible=true amber marker=true; PASS Listed GPU no warning: warn display=none; PASS Poisoned import finite: non-finite=none literal=none; PASS Manifest icons: sizes=192x192,512x512 files=true,true
PASS  Math known-answers: PASS Model memory ≈ 23.9 GB: rModelMem=23.9 (expected ≈23.9); PASS KV cache ≈ 42.4 GB: rKvCache=42.37 (expected ≈42.4 — catches dropped ×2 K+V); PASS GPUs Needed = 8: rGpusNeeded=8 (expected 8 — TP×PP floor); PASS Decode throughput ≈ 1523 tok/s: rDecodeThroughput=1523 (expected ≈1523)
PASS  GAP hardening (019-022): PASS Share link hash survives load: hash=#eyJwcmVzZXQiOiJkZ… loaded=60; PASS Share link quant sanitized to default: quant="4.5" (expect "4.5"); PASS Share link restores preset: preset="deepseek-v3"; PASS Share link preset description back: desc visible=true len=73; PASS Share link params restored: params="671" (expect "671"); PASS Share link results finite (no NaN): non-finite=none literal=none; PASS importConfig creates file input: captured; PASS Import sanitizes poisoned quant: quant="4.5" (expect "4.5"); PASS Import results finite (no NaN): non-finite=none literal=none; PASS Import of out-of-list quant keeps banner visible: banner display= text="⚠ Quantization \"3.5\" is not supported — results below use Q4_K_M (~4.5 bpw); pick a supported quantization to dismiss."; PASS Import restores preset from file: preset="deepseek-v3" (expect "deepseek-v3"); PASS Banner visible on blank quant: visible=true text="⚠ Select a quantization."; PASS Blank quant stays finite (IE-GAP-019 guard): non-finite=none literal=none; PASS Banner hidden on valid input: banner display=none
PASS  Alphabetical presets: 60/60 options, sorted=true, missing=0
FAIL  Docs consistency: PASS README.md present: 3929 bytes; PASS No stale "42" in README/QUICKSTART: clean; PASS Preset counts match models/index.json: all claims = 60; PASS Standalone size claim within ±1% of dist: README.md=190 KB vs actual 190.1 KiB; PASS README links to docs/QUICKSTART.md: docs/QUICKSTART.md; PASS README links to docs/GLOSSARY.md: docs/GLOSSARY.md; PASS README links to docs/FORMULAS.md: docs/FORMULAS.md; FAIL CHANGELOG date freshness: stale: newest CHANGELOG entry 2026-08-27 is older than newest commit 2026-09-04 — add a section for recent changes
PASS  Dist freshness: PASS source marker: validationBanner element: present in dist; PASS source marker: URL hash encoder: present in dist; PASS source marker: URL hash decoder: present in dist; PASS source marker: model library loader: present in dist; PASS embedded preset count: dist=60, source fallback=60, models/index.json=60
PASS  Board evidence: PASS real board passes gate: board evidence OK: 74 complete rows, 74 with commit_hash, 0 missing; PASS cleared hash rejected: exit 1, names BOARD-V2; PASS bogus hash rejected: exit 1, names BOARD-V2
PASS  CE-010 topology wiring (IE-GAP-031): PASS Auto penalty fires when TP spans 2 nodes: TP=16 gpusPerServer=8 auto → 1.19×; PASS Auto penalty = formula value (1+log10(18)×0.15 = 1.19): penalty=1.190 expected≈1.188; PASS Single-node config stays intra-node: TP=16 gpusPerServer=16 auto → None (intra-node); PASS Cross-node penalty differs NVLink-900 vs PCIe-5: NVLink ×1.190 (18:1) vs PCIe-5 ×1.110 (5.12:1); PASS Decode throughput differs NVLink-900 vs PCIe-5: rDecodeThroughput 2564 → 2754 tok/s (NVLink → PCIe-5); PASS Effective throughput differs NVLink-900 vs PCIe-5: rEffectiveThroughput 2564 → 2754 tok/s; PASS Throughput delta matches penalty ratio: decode ratio 1.074 vs penalty ratio 1.072
PASS  IE-GAP-032 infeasible verdict: PASS Infeasible case util > 100%: rUtil=120.8% (expected 120.8%); PASS Infeasible case util class = bad: util card class=metric bad; PASS Sweet Spot flags infeasibility: sweet="Does not fit on H100 80GB: 120.8% util — 96.6 GB/GPU > 80 GB. Raise TP/PP, reduce context/batch, or use a larger GPU"; PASS Sweet Spot carries a fix direction: sweet="Does not fit on H100 80GB: 120.8% util — 96.6 GB/GPU > 80 GB. Raise TP/PP, reduce context/batch, or use a larger GPU"; PASS Sweet Spot is NOT Tight fit: sweet="Does not fit on H100 80GB: 120.8% util — 96.6 GB/GPU > 80 GB. Raise TP/PP, reduce context/batch, or use a larger GPU"; PASS Sweet Spot card painted bad (red): sweet card class=metric bad; PASS GPUs Needed masked (not the TP-floor 8): rGpusNeeded="N/A (infeasible)" (must not present 8 as a valid answer); PASS Monolithic twin stays feasible: rUtil=74.4% (expected 74.4%); PASS Feasible twin keeps normal verdict: sweet="Tight fit — no headroom"; PASS Feasible twin GPUs Needed numeric: rGpusNeeded="8"; PASS Raise-TP direction works (TP=16 fits): rUtil=86.9% (expected 86.9%)
PASS  IE-GAP-033 TGI batching occupancy: PASS Shared TGI multiplier helper exposed: function; PASS Batch-8 multiplier >= 0.5 (was 0.047): m(8,32K)=0.5028; PASS Batch >= maxBatchSize hits ceiling 1.0 × batchEff: m(128,1K)=0.7500; PASS Token budget caps long-context overload: m(128,32K)=0.0391 (in-flight 1.26M > 65,536); PASS Short context does not trigger token penalty: m(8,1K)=0.5028 (in-flight 2.5K < 65,536); PASS Occupancy monotonic in batch (token-budget-free regime): m16=0.5107 m8=0.5028; PASS TGI batch-8 decode no longer collapses (>= 500 tok/s): rDecodeThroughput=863 (was ~80 pre-fix); PASS TGI batch-8 within ~2.5x of vLLM (19x gap gone): TGI 863 vs vLLM 1523 tok/s (ratio 0.567); PASS Implied batch-8 multiplier >= 0.5 (from rendered numbers): implied ×0.503 (raw 1288 tok/s); PASS Saturation: batch 128 TGI ≈ raw throughput (×1.0 net): TGI 1288 vs raw 1288 tok/s; PASS Token-budget cap binds on 128×32K overload: TGI 67 tok/s vs 1288 at saturation (×0.052)
PASS  IE-GAP-035 MoE+EP (CE-012): PASS epSize=1: MoE-Adjusted GPUs == GPUs Needed: rEpAdjustedGpus=8 vs rGpusNeeded=8; PASS epSize=1: EP efficiency = 100.0%: rEpEfficiency=100.0%; PASS epSize=1: GPUs Needed unchanged at 8 (worked example): rGpusNeeded=8; PASS epSize=1: note states EP disabled (no fake 40% all-to-all): notes contains EP=1 (disabled): true; PASS epSize=1: note has no all-to-all overhead %: note text:  MoE: 671B total / 37B active. Only active params consume VRAM during inference. CE-012 Expert Parallelism: EP=1 (disabled) — no all-to-all or load-imbalance ov; PASS epSize=2: adjusted GPUs match pre-fix formula: rEpAdjustedGpus=11 (expected 11); PASS epSize=2: efficiency matches pre-fix formula: rEpEfficiency=70.0% (expected 70.0%); PASS epSize=4: adjusted GPUs match pre-fix formula: rEpAdjustedGpus=10 (expected 10); PASS epSize=4: efficiency matches pre-fix formula: rEpEfficiency=80.0% (expected 80.0%); PASS epSize=8: adjusted GPUs match pre-fix formula: rEpAdjustedGpus=10 (expected 10); PASS epSize=8: efficiency matches pre-fix formula: rEpEfficiency=85.0% (expected 85.0%); PASS pane epSize=1: MoE-Adjusted GPUs == base: A_rEpAdjustedGpus=8 vs A_rGpusNeeded=8; PASS pane epSize=1: EP efficiency = 100.0%: A_rEpEfficiency=100.0%; PASS pane epSize=1: base = 8 (worked example): A_rGpusNeeded=8; PASS pane epSize=2: adjusted GPUs match old formula: A_rEpAdjustedGpus=11 (expected 11)
PASS  IE-GAP-036 quant clamp visibility: PASS setConfig: quant select clamped to Q4_K_M (never blank): quant="4.5" (expect "4.5"); PASS setConfig: clamp marked on select: data-clamped-from="3.5"; PASS setConfig: status flash names original value + fallback: "quant \"3.5\" not supported — using Q4_K_M (~4.5 bpw)"; PASS setConfig: validation banner visible after recalculate: display= text="⚠ Quantization \"3.5\" is not supported — results below use Q4_K_M (~4.5 bpw); pick a supported quantization to dismiss."; PASS setConfig: rendered numbers stay finite: non-finite=none literal=none; PASS Manual pick clears clamp warning: display=none marker=false; PASS importConfig: quant clamped to Q4_K_M: quant="4.5"; PASS importConfig: clamp flash survives alongside Imported ✓: "quant \"3.5\" not supported — using Q4_K_M (~4.5 bpw) · Imported ✓"; PASS importConfig: banner visible: display=; PASS importConfig: rendered numbers stay finite: non-finite=none literal=none; PASS paneSetConfig: pane quant clamped, never blank: A_quant="4.5" (expect "4.5"); PASS paneSetConfig: clamp flash surfaces via global status: "quant \"3.5\" not supported — using Q4_K_M (~4.5 bpw)"; PASS paneSetConfig: quant label reflects the clamped option: "Q4_K_M (~4.5 bpw)"; PASS pane: no NaN renders: clean; PASS paneSetConfig: matched quant does not queue a clamp flash: "Pane import ✓"; PASS Main grid restored after compare exit: quant="8.0"
---
14/15 groups passed in 4.9s exits 1 despite all 14 functional groups passing, and th
- [P2] Invalid-input banner does not name the offending field — A bad KV-precision value produced NaN KV Cache/VRAM while the warning only said 'check quantization and model fields' — no field name, so the user must guess which input to fix (evidence: real-use fri
- [P2] No port-conflict guidance in QUICKSTART — Documented  was already occupied on the judge's host; docs give no alternate-port invocation, forcing the user to improvise (evidence: real-use friction 1) — environment q
- [P2] file:// fallback wording misleads: 'Embedded presets' vs 'Loaded N models' — Source-mode file:// flashes 'Embedded presets' (60 embedded models) while docs describe a loaded-models line; judge initially misread the working fallback as broken (evidence: new_user_needs 4).
- [P2] Browser regression leg is Node-22-only with unverifiable playwright install — Downloading Chrome for Testing 151.0.7922.34 (playwright chromium v1234) from https://cdn.playwright.dev/builds/cft/151.0.7922.34/linux64/chrome-linux64.zip
|                                                                                |   0% of 184.3 MiB
|■■■■■■■■                                                                        |  10% of 184.3 MiB
|■■■■■■■■■■■■■■■■                                                                |  20% of 184.3 MiB
|■■■■■■■■■■■■■■■■■■■■■■■■                                                        |  30% of 184.3 MiB
|■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■                                                |  40% of 184.3 MiB
|■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■                                        |  50% of 184.3 MiB
|■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■                                |  60% of 184.3 MiB
|■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■                        |  70% of 184.3 MiB
|■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■                |  80% of 184.3 MiB
|■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■        |  90% of 184.3 MiB
|■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■| 100% of 184.3 MiB
Chrome for Testing 151.0.7922.34 (playwright chromium v1234) downloaded to /tmp/dj-judge/run2/.cache/ms-playwright/chromium-1234
Downloading FFmpeg (playwright ffmpeg v1011) from https://cdn.playwright.dev/dbazure/download/playwright/builds/ffmpeg/1011/ffmpeg-linux.zip
|                                                                                |   0% of 2.3 MiB
|■■■■■■■■                                                                        |  10% of 2.3 MiB
|■■■■■■■■■■■■■■■■                                                                |  20% of 2.3 MiB
|■■■■■■■■■■■■■■■■■■■■■■■■                                                        |  30% of 2.3 MiB
|■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■                                                |  40% of 2.3 MiB
|■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■                                        |  50% of 2.3 MiB
|■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■                                |  60% of 2.3 MiB
|■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■                        |  70% of 2.3 MiB
|■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■                |  80% of 2.3 MiB
|■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■        |  90% of 2.3 MiB
|■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■| 100% of 2.3 MiB
FFmpeg (playwright ffmpeg v1011) downloaded to /tmp/dj-judge/run2/.cache/ms-playwright/ffmpeg-1011
Downloading Chrome Headless Shell 151.0.7922.34 (playwright chromium-headless-shell v1234) from https://cdn.playwright.dev/builds/cft/151.0.7922.34/linux64/chrome-headless-shell-linux64.zip
|                                                                                |   0% of 114.7 MiB
|■■■■■■■■                                                                        |  10% of 114.7 MiB
|■■■■■■■■■■■■■■■■                                                                |  20% of 114.7 MiB
|■■■■■■■■■■■■■■■■■■■■■■■■                                                        |  30% of 114.7 MiB
|■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■                                                |  40% of 114.7 MiB
|■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■                                        |  50% of 114.7 MiB
|■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■                                |  60% of 114.7 MiB
|■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■                        |  70% of 114.7 MiB
|■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■                |  80% of 114.7 MiB
|■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■        |  90% of 114.7 MiB
|■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■| 100% of 114.7 MiB
Chrome Headless Shell 151.0.7922.34 (playwright chromium-headless-shell v1234) downloaded to /tmp/dj-judge/run2/.cache/ms-playwright/chromium_headless_shell-1234 completed with an empty log in sandboxed HOME, and there is no standalone  escape hatch — the browser leg cannot be independently run or verifie
