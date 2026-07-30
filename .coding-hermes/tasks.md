# Inference Cluster Estimator — Tasks

## Phase 1: Model Presets
- [ ] **CE-001**: Add model preset dropdown with common architectures (Llama-3-70B, Llama-4-400B-MoE, DeepSeek-V3, DeepSeek-V4, Mixtral-8x22B, Qwen2.5-72B, etc.) — auto-fills params, layers, KV heads, head dim, hidden size
- [ ] **CE-002**: Presets stored as JSON object in JS, filterable by architecture type

## Phase 2: Pricing
- [ ] **CE-003**: Add cloud GPU pricing data (Lambda, RunPod, Vast.ai, CoreWeave representative prices)
- [ ] **CE-004**: Cost-per-1M-tokens estimate (input/output split)
- [ ] **CE-005**: Breakeven analysis: self-hosted vs API (OpenRouter, Together, Fireworks)

## Phase 3: Serving Engine Models
- [ ] **CE-006**: vLLM overhead model (paged attention, prefill batching behavior)
- [ ] **CE-007**: SGLang RadixAttention cache-aware scheduling impact
- [ ] **CE-008**: TGI continuous batching efficiency

## Phase 4: Advanced Topology
- [ ] **CE-009**: NVLink domain modeling (within-node bandwidth vs cross-node)
- [ ] **CE-010**: Multi-node scaling efficiency curves (communication overhead)
- [ ] **CE-011**: Expert placement for MoE (EP — expert parallelism)

## Phase 5: Throughput Modeling
- [ ] **CE-012**: Prefill throughput (tokens/sec) separate from decode throughput
- [ ] **CE-013**: Time-to-first-token (TTFT) estimate based on prompt length
- [ ] **CE-014**: Speculative decoding throughput boost estimates
- [ ] **CE-015**: Concurrent user modeling (requests/sec at target latency)

## Phase 6: Polish
- [ ] **CE-016**: Dark/light theme toggle
- [ ] **CE-017**: Shareable URL (encode config in URL hash)
- [ ] **CE-018**: Comparison mode (side-by-side two configs)
- [ ] **CE-019**: Print-friendly CSS
- [ ] **CE-020**: Service Worker for offline use
