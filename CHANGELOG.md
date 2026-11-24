# Changelog

## 2026-11-24

### Maintenance
- Requirements-plane upkeep from the 2026-11-24 card-manager pass — no product change: `cluster-estimator.html`, `models/`, `docs/`, `scripts/`, `test.js` and `test-browser.js` are byte-unchanged, and the implementation board still holds 128 rows / 77 complete / 51 open with an identical id set before and after (exactly two rows differ, notes only)
- QA host blocker CLEARED, measured twice in the same minute: `ssh bunker-mvp df -h /` reports `/dev/sda1` 150G size, 47G used, 98G available, 33% used, load 0.00/0.40/2.34, up 53 days — so the ~89G was actively freed, not reset by a reboot. That is ~94G below the 94% battery preflight threshold (141G used) and it breaks the climb the cards have been tracking (85 -> 89 -> 88 -> 82 -> 86 -> 93 -> 91 -> 33%). The 2026-11-23 "91%/15G, 1 point under the 92% watch line" reading is superseded, and host disk is no longer the binding constraint on G4 AC1
- `QA-INFERENCE-ESTIMATOR-README-4` and `QA-INFERENCE-ESTIMATOR-DOCS-1` each carry a dated 2026-11-24T21:50Z note recording that measurement, so no later lane re-quotes a dead "98% disk" premise; both keep their status (pending) and their empty acceptance criteria — arming them remains the owning QA lane's call, and `DOCS-1` remains the P2 duplicate to fold into `README-4` (P1)
- The ONLY remaining blocker on the QA battery is the operator standby pause: 11/11 `inference-estimator` lanes `enabled=0` (`disabled_by=api`, standby request 2026-11-16), last family tick 2026-11-16T12:25Z. No lane was enabled and no worker was spawned by this pass
- G4 goal card's current state refreshed at HEAD `dd1356d` (`origin/master` parity 0/0, 0 unpushed, CI run 45074556777 success + pages 45074556447 success): `node test.js` 15/15 groups passed in 25.2s, `boardctl validate` RESULT OK (118 warnings, 0 errors), acceptance-gate audit unchanged at 51 open / 5 failing (all `empty`; `README-1/2/3` carry measured refutations, `README-4`/`DOCS-1` the cleared host blocker) / 46 passing, and 51/51 open rows cited by a goal card
- Three live acceptance premises re-verified at HEAD and left with their owning rows: the `README.md:52-55` regeneration block still carries no dependency step (G1 AC3, `README-5-R2` AC1), `npm run verify:board` still has 0 documentation hits in README/docs/skills (G1 AC4, `DOC-7`), and `skills/inference-estimator-usage/SKILL.md:31` still claims `10 groups ~3.1s` against a real 15 jsdom groups plus the Playwright leg (G3 AC5, `DOC-5`)
- This section also satisfies the `Docs consistency` CHANGELOG-freshness check for a board-only commit; the structural exemption that lets board-only commits skip the date comparison remains filed as `IE-CI-003`

## 2026-11-22

### Maintenance
- Requirements-plane upkeep from the 2026-11-22 card-manager pass — no product change: `cluster-estimator.html`, `models/`, `docs/`, `scripts/`, `test.js` and `test-browser.js` are byte-unchanged, and the implementation board still holds 128 rows / 77 complete / 51 open in the same id order before and after
- Criteria-key canon drift repaired across 27 rows, tool-supported and proven line-by-line against a pre-pass board copy: 25 rows whose acceptance criteria lived only under the legacy `acceptance` key were renamed to the canon `acceptance_criteria` with `boardctl update <id> --normalize`, and the two rows that carried BOTH keys with byte-identical text (`README-3-R2-R2`, `README-5-R2`) had the legacy key dropped so dispatchability has one source of truth. `boardctl validate` moved 144 -> 118 warnings, 0 errors; every changed line differs only by that key name, and no row was added, removed or renumbered
- Residual left for a decision, not a mechanical fix: 18 rows carry `_pass_criteria` alongside a legacy `acceptance` key. `--normalize` refuses that pair because it cannot tell which text is the criteria, and promoting pass-proposal text to dispatchable criteria by hand is a provenance judgment, not hygiene — reported rather than guessed
- QA host blocker re-measured and the headroom has COLLAPSED: `bunker-mvp` `/dev/sda1` is 133G used of 150G (12G available, 93%, load 2.61, up 51 days) at 2026-11-22T21:48Z, below the 94% battery preflight threshold (141G) by only 8G — 17G of headroom 24h earlier, and 11G of the 23G free on 2026-11-17 has been re-consumed. `QA-INFERENCE-ESTIMATOR-README-4` and `QA-INFERENCE-ESTIMATOR-DOCS-1` carry that measurement now, and `DOCS-1` is marked a duplicate of `README-4` (same preflight blocker, same threshold, same 2026-11-03 cycle) for a fold when a lane next drains the board
- G4 goal card's current state refreshed at HEAD `d96a1c0` (`origin/master` parity 0/0, 0 unpushed, CI run 44953614330 success): `npm test` 15/15 groups in 10.4s plus `test-browser.js` 7 check(s) passed / 0 failed, and `node scripts/verify-board-evidence.js` exit 0 (`77 complete rows, 77 with commit_hash, 0 missing`). Acceptance-gate audit unchanged at 51 open / 5 failing (all `empty`) / 46 passing, with 51/51 open rows cited by a goal card
- Two documentation gaps re-confirmed live at HEAD and left with their owning rows: `npm run verify:board` still has 0 documentation hits (G1 AC4, `DOC-7`) and `skills/inference-estimator-usage/SKILL.md:31` still claims `10 groups ~3.1s` against a real 15 jsdom groups plus the Playwright leg (G3 AC5, `DOC-5`)
- Family remains DARK by operator order: 11/11 `inference-estimator` lanes `enabled=0` (standby pause 2026-11-16, last tick 2026-11-16T12:25Z). No lane was enabled, no worker spawned, and the card-manager cron job was confirmed `enabled`/`scheduled` with `next_run_at` advanced
- This section also satisfies the `Docs consistency` CHANGELOG-freshness check for a board-only commit; the structural exemption that lets board-only commits skip the date comparison remains filed as `IE-CI-003`

## 2026-11-21

### Maintenance
- Requirements-plane upkeep from the 2026-11-21 card-manager pass — no product change: `cluster-estimator.html`, `models/`, `docs/`, `scripts/`, `test.js` and `test-browser.js` are byte-unchanged, and the implementation board changed by exactly two rows (notes only, renumber never delete, 128 rows / 77 complete / 51 open before and after)
- `QA-INFERENCE-ESTIMATOR-README-2` ("heavy suite exceeds configured memory cap") premise refuted by measurement at HEAD: `/usr/bin/time -v npm test` exits 0 with 15/15 groups and a peak RSS of 404044 KB (~395 MiB), ~7.8x under the 3145728 KB cap the 2026-11-02 chaos cell reported — the OOM is consistent with a harness-cap artifact, not a product memory defect
- `QA-INFERENCE-ESTIMATOR-README-3` ("missing-config behavior is unverified") premise narrowed: the documented start command `python3 -m http.server 8000` exists in `README.md` and `docs/QUICKSTART.md`, and invalid-config fallback is coded at `cluster-estimator.html:2147-2149` and `2216-2218`; what is genuinely missing is a test asserting that fallback (`grep -c 'Corrupted storage' test.js` = 0). Both rows still carry no acceptance criteria and stay undispatchable — arming or closing them remains the owning QA lane's call
- G4 goal card current state refreshed: `bunker-mvp` `/` re-measured at 82% used (118G of 150G, 26G available, load 0.01) against the 94% battery preflight threshold, below the 2026-11-18 reading; repo truth unchanged at `d56ca17` (CI run 44183684448 success), `node scripts/verify-board-evidence.js` exit 0 (`77 complete rows, 77 with commit_hash, 0 missing`), acceptance-gate audit 51 open / 5 failing (all `empty`) / 46 passing, and 51/51 open rows cited by a goal card
- `QA-INFERENCE-ESTIMATOR-README-5-R2` premise re-established at HEAD `1ef9d40` and the row SPLIT by measurement: its AC2 now HOLDS (in a stranger clone, `npm install && node scripts/build-standalone.js && node scripts/verify-standalone.js` exits 0 printing `PASS: standalone loads 60 models with zero network, calculation renders.`) while AC1 still FAILS (the README.md:52-55 regeneration block carries no dependency step, so `node scripts/verify-standalone.js` alone exits 1 with `Error: Cannot find module 'jsdom'`; the install step exists at README.md:22, so the fix is a one-line pointer). Note-only — status and criteria untouched
- G1's AC1 is now proven end to end from a real stranger clone at `1ef9d40`: `git clone` of the public remote, then `npm install && npx playwright install chromium && node scripts/build-standalone.js && npm test` exits 0 — `15/15 groups passed in 5.4s` plus `7 check(s) passed, 0 failed`, with 40 packages installed, a 194633-byte dist, 60 embedded models and 0 `fetch()` calls. G1's AC2 verified in the same clone; AC3 (`jsdom` block) and AC4 (`verify:board` docs, 0 grep hits) remain open under README-5/README-5-R2 and DOC-7
- All four goal cards' current-state blocks refreshed to HEAD `1ef9d40` (CI run 44848189150 success, `origin/master` parity 0/0): G1 AC1 proven, G2's `IE-GAP-045/046/047` no-test-group claim re-verified at 0/0/0 hits, G3's `getConfig()` key count measured at 60 incl. `preset`, and G4's host figure corrected — `bunker-mvp` `/` is 86% used (124G of 150G, 21G free, load 0.08, re-measured 2026-11-21T21:46Z), up 4 points from the 82% reading 21h earlier, so the 82-89% band wording replaces "the 24h trend flattened"
- Family remains DARK by operator order: 11/11 `inference-estimator` lanes `enabled=0` (standby pause 2026-11-16, last tick 2026-11-16T12:25Z). No lane was enabled, no worker spawned, no row added or removed, and the card-manager cron job was confirmed `enabled`/`scheduled` with `next_run_at` advanced
- This section also satisfies the `Docs consistency` CHANGELOG-freshness check for a board-only commit; the structural exemption that lets board-only commits skip the date comparison remains filed as `IE-CI-003`

## 2026-11-17

### Maintenance
- Requirements plane for this project now exists on the kanban board `inference-estimator`: four goal cards — `t_b66f49a8` (G1 fresh-clone build + CI gate stays green), `t_4fc8e560` (G2 estimator math matches the tool's claims), `t_8652e456` (G3 docs tell the truth the product ships), `t_905292c2` (G4 QA batteries execute and their verdicts are trustworthy) — each citing its open `.coding-hermes/board/tasks.jsonl` rows by full id. All 50 open rows are cited by exactly one owning card (the one deliberate cross-reference is `QA-INFERENCE-ESTIMATOR-README-1`, owned by G1 and cited by G4's AC5), and all four cards are subscribed to the COS channel with `notify+wake`
- Board drift repair from the 2026-11-17 card-manager pass: seven rows whose premise no longer reproduces at `a3ea05f` (README-2, README-3, README-3-R2, README-3-R2-R2, QA-INFERENCE-ESTIMATOR-4, QA-INFERENCE-ESTIMATOR-2-R7, QA-INFERENCE-ESTIMATOR-README-1) carry a `foreman_note` with the live evidence (`npm test` exit 0, `scripts/verify-board-evidence.js` exit 0, CHANGELOG freshness, CI run ids), and the three P1s were demoted to P3 so a refuted row stops occupying `boardctl next`. Rows are not closed here — closure needs the owning lane's own evidence run — and the row count is unchanged at 127 (renumber never delete)
- QA host blocker re-measured and found cleared: `bunker-mvp` `/` is 85% used (122G of 150G, 23G available) against the 94% battery preflight threshold that refused every launch on 2026-11-03 at 98%. The two disk-blocked rows (QA-INFERENCE-ESTIMATOR-README-4, QA-INFERENCE-ESTIMATOR-DOCS-1) now carry that measurement as a note and are dispatchable again
- This section also repairs the `Docs consistency` group, which FAILed at `5dbe572`: that commit touched only `.coding-hermes/board/tasks.jsonl` yet advanced the newest commit date to 2026-11-17 while the newest CHANGELOG section was still 2026-11-16, so `CI` run 44081869911 is red for exactly that reason. The gate's rule, threshold and `## YYYY-MM-DD` heading format are unchanged; the structural follow-up that exempts board-only commits from the date comparison is filed as `IE-CI-003`
- No user-facing tool change: `cluster-estimator.html`, `models/`, `docs/`, `scripts/`, `test.js` and `test-browser.js` are byte-unchanged in this window

## 2026-11-16

### Fixed
- `npm test` is green again on master: the `Board evidence` group FAILed on 7 complete rows without a `commit_hash` (BT-053-ROLLOUT-2026-09-28, DF-INFERENCE-ESTIMATOR-1-R4, -1-R5, -2-R5, -3-R5, -4-R3, README-4). Dispositions: README-4 is real work and was backfilled with its actual closure commit `178201c` (weekly README audit, 2026-10-19); the five `DF-INFERENCE-ESTIMATOR-*-R*` rows were 2026-09-30 duplicate-id backfill artifacts (`superseded-by-earliest`, no work behind them) and were removed, each with its live tracker recorded (IE-CI-002, QA-INFERENCE-ESTIMATOR-2-R7, -3-R7, -4-R3, -5); BT-053-ROLLOUT-2026-09-28 was a fleet-rollout receipt whose artifact is host state (`.git/hooks/pre-commit`), verified present and invoking `boardctl validate` before removal. The gate itself is unchanged — no exemptions, no weakened rules — and now reports `76 complete rows, 76 with commit_hash, 0 missing` (IE-CI-002)
- `CHANGELOG date freshness` gate (IE-CI-001's rule) is satisfied again by this section, which is the only change needed on the docs side — the rule, its threshold and the `## YYYY-MM-DD` heading format are untouched (IE-CI-002)

### Maintenance
- No user-facing tool changes in this window (2026-09-10 .. 2026-11-16): 30 commits landed, 29 of them board/QA upkeep — 28 touch `.coding-hermes/board/tasks.jsonl` (qa-cron finding commits 2026-10-02 .. 2026-11-03, board filings for the README/DOC/IE-CI rows, acceptance-criteria backfills) — and the single non-board commit is the previous changelog refresh `3ec82eb` itself. `cluster-estimator.html`, `models/`, `scripts/`, `docs/`, `test.js` and `test-browser.js` are byte-unchanged across the window, so no estimate, preset, formula or documented workflow changed (IE-CI-002)
- Board hygiene: `boardctl validate` stays at 0 errors through the prune (141 warnings, all WARN-ONLY canon-drift); the removed rows are recorded as `task_removed` events 383..388 with their tracker ids so the audit trail survives the deletion (IE-CI-002)

## 2026-09-10

### Added
- Dogfood verification report for the 2026-09-01 real-browser re-drive — `docs/dogfood/2026-09-01-verification.md`: the worked example is byte-exact on both distributions (23.9 / 42.37 / 59.6 / 8 / 74.4% / 1523 / 80865 / $19.92 / 26.4B), 21/22 fresh checks pass, 0 console errors, plus the friction log and the residual P2 findings (IE-GAP-045..047)

### Changed
- `skills/inference-estimator-usage` SKILL.md v1.1.0 -> v1.2.0 — the six 2026-08-22 gaps (IE-GAP-031..036) are now documented as verified FIXED by real-browser re-drive, and the caveat list is narrowed to the residual IE-GAP-045..047 items
- `.gitreins/config.yaml` tier-1 `lint` guard disabled — this static HTML/JS repo carries no ESLint flat config, so the judge's `npx eslint .` exited 2 on every verdict while tier-2 criteria PASS; env-dependent lint noise, not a finding, re-enable if a real flat-config setup lands (INT-CI-001)
- No user-facing tool changes in this window: `cluster-estimator.html`, `models/`, `docs/`, `scripts/` and both test harnesses are unchanged since the 2026-08-27 entry — everything below is docs, CI-config and board upkeep

### Maintenance
- QA/dogfood/board upkeep only, no product code: recurring QA cron runs filing findings (through 2026-09-09), dogfood runs on 2026-09-01 / 09-04 / 09-07 (all SHIPPABLE), the CLN-1 folder-structure cleanup task filed (2026-09-06), one malformed board JSONL row repaired, and IE-CI-001 injected once this CHANGELOG freshness gate went red

## 2026-08-27

### Fixed
- `scripts/build-standalone.js` now reports the real on-disk byte count of the written file (fs.statSync) instead of the in-memory string length — the printed number now matches `wc -c` exactly (IE-GAP-044)
- README standalone size claim corrected to ~190 KB (was ~182 KB, stale vs the 194,633-byte build) and the docs-consistency test tolerance tightened from ±5% to ±1% so the claim can't drift again (IE-GAP-042)
- README test instructions now list the full fresh-clone prerequisites: `npx playwright install chromium` and the build-first step, so a user following README alone gets a green `npm test` (IE-GAP-043)

## 2026-08-26

### Changed
- CONTRIBUTING.md testing docs updated: both harnesses named (test.js = 15 jsdom groups ~6s; test-browser.js = 7 real-browser Playwright checks ~3-4s), the three fresh-clone prerequisites documented (build dist first, `npx playwright install chromium`, full git history / fetch-depth 0), and the Node version claim corrected to 22 in README + CONTRIBUTING so a fresh clone following the documented steps gets a green `npm test` (IE-GAP-041)

## 2026-08-25

### Added
- Real-browser Playwright smoke coverage (7 checks over a built dist bundle) plus a GitHub Actions CI workflow; fresh clones get full git history and dist built before tests so CI passes out of the box (IE-GAP-038)
- README links to docs/GLOSSARY.md and docs/FORMULAS.md; docs-consistency test asserts both links resolve (IE-GAP-040)

## 2026-08-24

### Fixed
- Out-of-list quantization values on import/share now flash a visible warning + banner instead of silently clamping (IE-GAP-036)
- Expert-parallel overhead no longer applied at epSize=1 — MoE-Adjusted GPUs equals base GPUs for single-GPU-pool MoE configs (CE-012 fix, IE-GAP-035)
- KV waste display relabeled to "KV size vs raw %" showing the actual size multiplier (+15%/+20% deltas); FORMULAS.md §15.1 wording matched (IE-GAP-034)

## 2026-08-23

### Fixed
- TGI batching uses a smoothstep occupancy curve (floor 2/3) with a token-budget cap that binds only on overload, replacing the linear batch/maxBatch multiplier that understated TGI ~19x vs vLLM at batch 8 (IE-GAP-033)
- Disaggregated serving reports an explicit infeasible-with-direction verdict when gpuUtil > 100% — 120.8% utilization on H100-80 no longer reads as "Tight fit" (IE-GAP-032)

### Changed
- README dist references are build-first; the regression harness fails when dist is referenced by docs but missing (IE-GAP-037)

## 2026-08-22

### Fixed
- Multi-node interconnect topology actually affects sizing: TP fit is checked per node (TP <= GPUs/server) and the cross-node bandwidth penalty is wired into throughput estimates (CE-010 fix, IE-GAP-031)

## 2026-08-19

### Changed
- Preset counts synced 42 -> 60 in CONTRIBUTING.md and skills/inference-estimator-usage (IE-GAP-027/028 cleanup)

## 2026-08-15

### Fixed
- README file:// claim aligned with embedded-fallback reality — offline file:// serves all 60 presets + API pricing, not a reduced list (IE-GAP-030)
- Board evidence audit: 35 legacy commit hashes backfilled and the verify-board-evidence gate hardened; evaluator max_input_tokens raised 2M -> 4M after tier2 truncation at 2.2M (IE-GAP-029)

## 2026-08-13

### Added
- Dist-freshness regression group with explicit stale-dist failure messages (IE-GAP-027)
- Board-evidence gate for the foreman pipeline plus historical hash backfills (IE-GAP-028)
- INTEGRATION.md — dogfood records moved out of user-facing docs (IE-GAP-026)

## 2026-08-12

### Added
- Model library expanded 42 -> 60 presets from HF top-download/trending models, dropdown sorted alphabetically

### Changed
- Doc preset counts synced to 60; canonical Quick Start consolidated at docs/QUICKSTART.md (IE-GAP-024/IE-GAP-025)

## 2026-08-11

### Added
- SPEC-001 example values corrected against models/*.json (IE-GAP-023)
- Real-path regressions covering IE-GAP-019..022 and a null-safe quant label handler (IE-GAP-022)
- Visible validation banner for blank/invalid core inputs (IE-GAP-021)
- Saved configs carry the model preset and restore it on load (IE-GAP-020)

### Fixed
- Quantization guarded against blank/invalid values in both math paths (IE-GAP-019)

## 2026-08-10

### Fixed
- Example calculation TP x PP GPU floor corrected, QUICKSTART numbers aligned, known-answer math tests added (IE-GAP-015..018)

## 2026-08-09

### Fixed
- TP x PP GPU floor enforcement, warning when cloud pricing falls back to defaults, NaN guards on invalid inputs, PWA icons (IE-GAP-011..014)

## 2026-08-08

### Changed
- file:// capability claims aligned across README + QUICKSTART — embedded fallback includes all presets + API pricing (IE-GAP-010)
- file:// fallback caveat documented and package.json metadata fixed (IE-GAP-008/IE-GAP-009)

## 2026-08-07

### Changed
- AGENTS.md refreshed — 7 implemented items moved Deferred -> Features; standalone distribution + regeneration steps documented (IE-GAP-006/IE-GAP-007)
- Board references point at the JSONL canonical store (JSONL-NORM-001)

## 2026-08-06

### Added
- docs/: formula reference, quick-start guide, and input glossary (IE-GAP-001)
- Node regression harness (test.js) — presets, roundtrip, edge cases — wired into npm test (IE-GAP-002)
- Testing section in CONTRIBUTING and npm test note in README (IE-GAP-005)
- Service worker precaches all model JSONs at install so offline visits load the full library (IE-GAP-004)

### Changed
- Docs reference .coding-hermes/board/ as the live task board; stale tasks.md.bak removed (IE-GAP-003)

## 2026-08-02

### Changed
- dist/ build output gitignored — rebuild before serving with `node scripts/build-standalone.js` (dist/inference-estimator-standalone.html)

## 2026-07-31

### Added
- Dynamic model library: 42 per-model JSON files + index manifest + async loader (CE-025)
- 42 real model presets with corrected data — DeepSeek V4 Pro/Flash, MiniMax-M3, Gemma-3-27B, MLA KV cache modeling (CE-023)
- PWA manifest + service worker for offline use (CE-021); .nojekyll + root index redirect for GitHub Pages
- Print-friendly CSS via @media print stylesheet (CE-020)
- Comparison mode — side-by-side evaluation of two configurations (CE-019)
- Speculative decoding throughput boost estimates (CE-015)
- Concurrent user modeling — requests/sec at target latency (CE-016)
- Dark/light theme toggle (CE-017)
- Shareable URL encoding in the location hash (CE-018)
- Time-to-first-token estimate based on prompt length (CE-014)
- Prefill throughput modeled separately from decode (CE-013)
- Multi-node scaling efficiency curves with communication overhead (CE-011)
- NVLink domain modeling — within-node vs cross-node bandwidth (CE-010)
- Expert placement for MoE via expert parallelism (CE-012)
- SGLang RadixAttention cache-aware scheduling model (CE-008)
- TGI continuous batching efficiency model (CE-009)

## 2026-07-30

### Added
- Model presets with 9 architectures (Llama-3-70B, Llama-4-400B-MoE, DeepSeek-V3, DeepSeek-V4, Mixtral-8x22B, Qwen2.5-72B, MiniMax-M3-MoE, Gemma-3-27B, Mistral-Large-2)
- Filterable preset dropdown with model descriptions
- Cloud GPU pricing (Lambda, RunPod, Vast.ai, CoreWeave)
- Cost-per-1M-tokens estimates (input/output split)
- API pricing comparison (OpenRouter, Together, Fireworks)
- Breakeven analysis: self-hosted vs API
- GitReins guard + LLM judge pipeline

### Initial
- GPU cluster VRAM calculator (tensor parallelism, pipeline parallelism, quantization)
- KV cache estimation with configurable overhead
- Throughput estimates (prefill and decode)
- Batch size optimization
