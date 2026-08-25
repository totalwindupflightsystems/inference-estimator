# Changelog

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
