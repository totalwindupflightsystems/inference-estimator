# Inference Cluster Estimator

Single-page static HTML tool for GPU cluster sizing estimation.

**Quick, no-dependency estimation for LLM inference cluster provisioning.** Run in any browser -- no server, no build step.

## What It Does

Model params + quantization + context -> VRAM, KV cache, GPUs needed, sweet spot analysis.

- Model Memory: parameter count x bits-per-weight -> raw model size in VRAM
- KV Cache: layers x KV heads x head dim x precision x context x batch -> cache footprint
- GPU Fit: per-GPU VRAM vs model + KV cache, accounting for TP/PP sharding and overhead
- Sweet Spot: under/over-provisioned analysis based on GPU count vs calculated need

## Usage

Open `cluster-estimator.html` in any browser. No dependencies, no build step.

To run the regression suite (presets, roundtrip, edge cases): `npm install && npm test` (Node 18+).

## Distribution

Two distributions ship from this repo:

- **`cluster-estimator.html`** (default) — fetches the 42 per-model JSONs from
  `models/` at runtime. Requires an HTTP server (or the GitHub Pages deploy);
  `file://` falls back to a small embedded preset list.
- **`dist/inference-estimator-standalone.html`** — 166 KB self-contained build
  with all 42 model presets inlined. Zero network requests, works from
  `file://` (double-click to open offline). The better distribution for local
  / air-gapped use.

### Regenerating the standalone build

```sh
node scripts/build-standalone.js   # reads cluster-estimator.html + models/*.json
node scripts/verify-standalone.js  # optional: proves 42 models load offline
```

`dist/` is gitignored build output — regenerate after any change to
`cluster-estimator.html` or `models/`.

## Architecture

- Single-file HTML, dark theme
- GPU specs: H100, H200, B200, A100, L40S, MI300X, RTX 6000 + custom
- Serving modes: Monolithic and Disaggregated
- Persistence: localStorage + JSON export/import

## License

MIT -- see LICENSE file.
