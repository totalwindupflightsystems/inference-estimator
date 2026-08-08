# Quick Start

## Serve the estimator (recommended)

The full feature set -- all 42 model presets with real specs, cloud GPU
pricing, and API cost comparison -- needs the model data in `models/`, which
`cluster-estimator.html` fetches at runtime. Serve the repo over HTTP:

```sh
python3 -m http.server 8000
# then open http://localhost:8000/cluster-estimator.html
```

(The GitHub Pages deploy at
https://totalwindupflightsystems.github.io/inference-estimator/ is the same
served experience.)

## Opening directly (file://)

Double-clicking `cluster-estimator.html` from the filesystem also opens the
page. `file://` cannot fetch `models/*.json`, so the page uses its embedded
fallback -- all 42 model presets and API pricing are baked in, and it logs a
console warning that live model updates are unavailable. For full offline use
from `file://`, use the self-contained standalone build instead:

```sh
node scripts/build-standalone.js   # regenerates dist/inference-estimator-standalone.html
# then open dist/inference-estimator-standalone.html (166 KB, all 42 presets inlined)
```

## Tests

```sh
npm install && npm test   # Node 18+ -- presets, roundtrip, edge cases
```
