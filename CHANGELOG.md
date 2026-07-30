# Changelog

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
