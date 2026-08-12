# Inference Cluster Estimator

Single-page static HTML tool for GPU cluster sizing estimation. Model params + quantization + context → VRAM, KV cache, GPUs needed, sweet spot analysis.

## Purpose
Quick, no-dependency estimation for LLM inference cluster provisioning. Run in any browser — no server, no build step.

## Core Concepts
1. **Model Memory** — Parameter count × bits-per-weight → raw model size in VRAM
2. **KV Cache** — Layers × KV heads × head dim × precision × context × batch → cache footprint
3. **GPU Fit** — Per-GPU VRAM vs model + KV cache, accounting for TP/PP sharding and overhead
4. **Sweet Spot** — Under/over-provisioned analysis based on GPU count vs calculated need

## Architecture
- **Single-file HTML** — Zero dependencies, dark theme, no build step
- **GPU Specs** — Hardcoded specs for H100/H200/B200/A100/L40S/MI300X/RTX6000 + custom
- **Serving Modes** — Monolithic (prefill+decode same GPU) and Disaggregated (separate)
- **Persistence** — localStorage for saving/loading configs; JSON export/import

## Features (Current)
- MoE architecture support (total vs active params)
- Quantization: IQ2_XXS through FP32
- KV cache precision: FP16, FP8, FP4
- Context length slider: 1K–1M tokens
- Tensor Parallel + Pipeline Parallel sharding
- Batch size, overhead %
- Cluster-level aggregation (servers × GPUs per server)
- tokens/$ estimate based on memory bandwidth and GPU pricing
- System RAM & NVMe cache estimates
- Model library presets (60 models: Llama, DeepSeek, Qwen, Gemma, Mistral, Phi, Granite, Ornith, …) with per-provider API pricing (OpenRouter/Together/Fireworks)
- Serving engine overhead models: vLLM, SGLang, TGI (KV waste, prefill/batch efficiency)
- Speculative decoding throughput estimates
- Multi-node interconnect topology: NVLink/NVSwitch and InfiniBand (intra/inter-node bandwidth)
- Prefill throughput separate from decode (monolithic vs disaggregated serving, CE-013)
- Continuous batching efficiency curves

## Deferred / Future
- Live cloud GPU pricing (real-time fetch; pricing tables are currently static)
- Training cost estimation (tool is inference-focused)
- Data-center power draw / electricity cost estimation

## File Layout
```
inference-estimator/
├── AGENTS.md
├── CONTRIBUTING.md
├── README.md
├── cluster-estimator.html    # The tool (HTML + CSS + JS, single file)
├── models/                   # Per-model JSON library (60 models + index.json)
├── docs/                     # Formula reference, quick-start, input glossary
├── scripts/                  # build-standalone.js + verify-standalone.js
├── dist/                     # Build output — standalone build (gitignored)
├── test.js                   # Node regression harness (presets/roundtrip/edge cases)
└── .coding-hermes/
    └── board/                # Live task board (JSONL store — tasks.jsonl + events.jsonl)
```

## DuckBrain
Namespace: `inference-estimator` — `/project/inference-estimator/identity`
