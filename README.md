# Inference Cluster Estimator

Single-page static HTML tool for GPU cluster sizing estimation.

**Quick, no-dependency estimation for LLM inference cluster provisioning.** Runs in any browser over an HTTP server or GitHub Pages -- no build step. (Opening `cluster-estimator.html` directly via `file://` also works: it falls back to the embedded library with all 60 model presets and API pricing included, just without live updates from `models/` -- see [Quick Start](docs/QUICKSTART.md) or the standalone build below.)

## What It Does

Model params + quantization + context -> VRAM, KV cache, GPUs needed, sweet spot analysis.

- Model Memory: parameter count x bits-per-weight -> raw model size in VRAM
- KV Cache: layers x KV heads x head dim x precision x context x batch -> cache footprint
- GPU Fit: per-GPU VRAM vs model + KV cache, accounting for TP/PP sharding and overhead
- Sweet Spot: under/over-provisioned analysis based on GPU count vs calculated need

## Usage

Open `cluster-estimator.html` in any browser. No dependencies, no build step.

Full pricing features (cloud GPU pricing, API cost comparison) need the runtime-fetched model data, so serve the repo over HTTP: `python3 -m http.server 8000` then open http://localhost:8000/cluster-estimator.html. A `file://` URL uses the embedded fallback data (all 60 model presets and API pricing included), but cannot pick up live updates from `models/` -- for the best `file://`/offline experience, open `dist/inference-estimator-standalone.html` instead -- note this file is gitignored build output: run `node scripts/build-standalone.js` first on a fresh clone (see Distribution).

To run the regression suite (presets, roundtrip, edge cases): `npm install && npm test` (Node 18+).

## Integration

Embed the tool in another page, share/restore state through the URL hash, or
work with the JSON export format — see [docs/INTEGRATION.md](docs/INTEGRATION.md).
It documents the hash state format (base64-encoded JSON in `location.hash`),
the full 60-field JSON export schema, and iframe embedding (no postMessage API;
use the standalone build for offline embeds).

See also: [docs/FORMULAS.md](docs/FORMULAS.md) for every formula behind the
estimates, and [docs/GLOSSARY.md](docs/GLOSSARY.md) for a definition of each
input field.

## Distribution

Two distributions ship from this repo:

- **`cluster-estimator.html`** (default) — fetches the 60 per-model JSONs from
  `models/` at runtime. Requires an HTTP server (or the GitHub Pages deploy);
  `file://` uses the embedded fallback (all 60 presets + API pricing baked in,
  no live updates).
- **`dist/inference-estimator-standalone.html`** — ~182 KB self-contained build
  with all 60 model presets inlined. Zero network requests, works from
  `file://` (double-click to open offline). The better distribution for local
  / air-gapped use. `dist/` is gitignored build output — not present on a
  fresh clone: run `node scripts/build-standalone.js` first (see below).

### Regenerating the standalone build

```sh
node scripts/build-standalone.js   # reads cluster-estimator.html + models/*.json
node scripts/verify-standalone.js  # optional: proves all models load offline
```

`dist/` is gitignored build output — not present on a fresh clone: run
`node scripts/build-standalone.js` before using the standalone build, and
regenerate after any change to `cluster-estimator.html` or `models/`.

## Architecture

- Single-file HTML, dark theme
- GPU specs: H100, H200, B200, A100, L40S, MI300X, RTX 6000 + custom
- Serving modes: Monolithic and Disaggregated
- Persistence: localStorage + JSON export/import

## License

MIT -- see LICENSE file.
