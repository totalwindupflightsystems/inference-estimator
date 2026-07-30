# Inference Cluster Estimator — Tasks

> **🛑 FOREMAN DIRECTIVE: This project is ACTIVE. All 🔴 Open tasks are REAL
> WORK, not optional extensions. Do NOT self-pause while open tasks remain.
> Bankai mode: all 6 phases. Every task must be completed.**

## Phase 1: Model Presets ✅ — completed 2026-07-30 tick 1
- [x] **CE-001**: Add model preset dropdown with common architectures — auto-fills params, layers, KV heads, head dim, hidden size
- [x] **CE-002**: Presets stored as JSON object in JS, filterable by architecture type
  - All 9 models: Llama-3-70B, Llama-4-400B-MoE, DeepSeek-V3, DeepSeek-V4, Mixtral-8x22B, Qwen2.5-72B, **MiniMax-M3-MoE**, Gemma-3-27B, Mistral-Large-2
- [x] **CE-003**: Preset descriptions — show model card summary on hover/select

## Phase 2: Pricing
- [ ] **CE-004**: Add cloud GPU pricing data (Lambda, RunPod, Vast.ai, CoreWeave representative prices)
- [ ] **CE-005**: Cost-per-1M-tokens estimate (input/output split)
- [ ] **CE-006**: Breakeven analysis: self-hosted vs API (OpenRouter, Together, Fireworks)

## Phase 3: Serving Engine Models
- [ ] **CE-007**: vLLM overhead model (paged attention, prefill batching behavior)
- [ ] **CE-008**: SGLang RadixAttention cache-aware scheduling impact
- [ ] **CE-009**: TGI continuous batching efficiency

## Phase 4: Advanced Topology
- [ ] **CE-010**: NVLink domain modeling (within-node bandwidth vs cross-node)
- [ ] **CE-011**: Multi-node scaling efficiency curves (communication overhead)
- [ ] **CE-012**: Expert placement for MoE (EP — expert parallelism)

## Phase 5: Throughput Modeling
- [ ] **CE-013**: Prefill throughput (tokens/sec) separate from decode throughput
- [ ] **CE-014**: Time-to-first-token (TTFT) estimate based on prompt length
- [ ] **CE-015**: Speculative decoding throughput boost estimates
- [ ] **CE-016**: Concurrent user modeling (requests/sec at target latency)

## Phase 6: Polish
- [ ] **CE-017**: Dark/light theme toggle
- [ ] **CE-018**: Shareable URL (encode config in URL hash)
- [ ] **CE-019**: Comparison mode (side-by-side two configs)
- [ ] **CE-020**: Print-friendly CSS
- [ ] **CE-021**: Service Worker for offline use
