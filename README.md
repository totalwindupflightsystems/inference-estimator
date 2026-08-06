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

## Architecture

- Single-file HTML, dark theme
- GPU specs: H100, H200, B200, A100, L40S, MI300X, RTX 6000 + custom
- Serving modes: Monolithic and Disaggregated
- Persistence: localStorage + JSON export/import

## License

MIT -- see LICENSE file.
