# Integration Guide

How to embed the Inference Cluster Estimator in another page, share/restore a
configuration through the URL, and work with the JSON export format.

The tool is a single static HTML file with **no build step and no server-side
API** — integration means moving a document around, not calling an endpoint.
Everything below is documented from the actual save/restore/export code in
`cluster-estimator.html` (CE-018 hash encoding, `getConfig()`/`setConfig()`,
`exportConfig()`/`importConfig()`), so the field names are the real ones.

---

## 1. Quick answers

| Question | Answer |
|---|---|
| Can I embed it in an iframe? | Yes — it is fully self-contained and origin-agnostic. See [§4](#4-iframe-embedding). |
| Is there a postMessage / JS API? | **No.** The page never calls `postMessage` and exposes no listener. The only integration channels are the URL hash and JSON files. |
| How do I share a configuration? | Use the in-page **🔗 Copy Link** button, or construct the hash yourself (see [§2](#2-url-hash-state-share-links)). |
| What does a share link look like? | `https://<host>/cluster-estimator.html#eyJwcmVzZXQiOiJ...` — the fragment is base64-encoded JSON. |
| How do I transfer a config between browsers/machines? | Export JSON (`cluster-config.json`) on one side, Import JSON on the other. |
| Is state kept on a server? | Never. All state lives in the URL fragment, `localStorage`, or files you export. |

---

## 2. URL hash state (share links)

The page stores the **entire configuration** in `location.hash` as
`base64(JSON)`, so a URL alone is a complete, shareable snapshot.

### Format

```
#<base64-encoded JSON document>
```

- The fragment is everything after `#` (no leading `#` in the payload).
- The payload is produced with the standard `btoa(JSON.stringify(cfg))`
  (UTF-8/ASCII — the config contains only ASCII field values).
- Decoding is `JSON.parse(atob(hash.substring(1)))`.

### How the tool writes it

- Every `recalculate()` schedules a **500 ms debounced** rewrite of the hash
  (`encodeConfigToHash()`), so editing any input updates the URL shortly after
  you stop changing values.
- The **🔗 Copy Link** button (`copyLink()`) copies the current
  `window.location.href` — including the hash — to the clipboard.
- While the page writes its own hash it sets an internal `hashUpdating` guard
  for ~100 ms so the `hashchange` listener does not re-decode its own write.

### How the tool reads it

- On initial load the hash is decoded **after** the localStorage restore, so a
  share link **overrides** a previously saved local config.
- `hashchange` events (back/forward navigation, manually edited URLs) are
  decoded live.
- The decode is repeated after the async model library (`models/*.json`) loads
  so a link naming a preset from the full library restores correctly
  (IE-GAP-020).
- Malformed hashes (bad base64, bad JSON) are **silently ignored**; a hash
  that decodes but contains invalid values is sanitized by `setConfig()` (see
  below).

### Reading / writing the hash yourself

```js
// Read the current config out of a URL
const cfg = JSON.parse(atob(location.hash.substring(1)));

// Write a config into the URL (any page can do this)
const cfg = { params: "70.0", quant: "4.5", context: "32768" /* ... */ };
location.hash = btoa(JSON.stringify(cfg));
```

### Validation & sanitization on restore (`setConfig()`)

- Unknown fields are ignored (the page restores only fields that match an
  element id).
- Checkboxes accept any truthy/falsy value.
- Numeric inputs (`number`/`range`): non-finite values (`NaN`, `Infinity`,
  empty string) fall back to the input's `min` (or 1); values below `min` are
  clamped up. Upper bounds are treated as UI hints, not hard limits — preset
  specs may legitimately exceed them.
- Selects: a value with no matching `<option>` falls back to the **first**
  option instead of leaving a blank select (IE-GAP-019).
- If the config names a `preset` that exists in the loaded model library, the
  preset is re-applied and re-fills its owned fields.

---

## 3. JSON export / import schema

**Export** (`exportConfig()`): downloads a file named `cluster-config.json`
containing `JSON.stringify(getConfig(), null, 2)` (pretty-printed, UTF-8,
`application/json`).

**Import** (`importConfig()`): opens a file picker, `JSON.parse`s the selected
file and passes it through the same `setConfig()` sanitization as a hash. Any
object with the field names below is accepted; unknown fields are ignored.

The exported document is a **flat JSON object with 60 fields**. All fields are
**strings** (raw input values) except the two checkboxes, which are booleans.
`setConfig()` accepts both strings and numbers on input.

### Field reference (grouped by feature area)

| Field | Type | Meaning |
|---|---|---|
| `preset` | string | Selected model-preset id from the model library (`""` = none selected) |
| `params` | string | Total parameters, billions (e.g. `"671.0"`) |
| `arch` | string | `"dense"` \| `"moe"` |
| `activeParams` | string | MoE active parameters, billions |
| `nLayers` | string | Transformer layers |
| `nKvHeads` | string | KV heads |
| `headDim` | string | Head dimension |
| `hiddenSize` | string | Hidden size |
| `quant` | string | Quantization preset id (e.g. `"4.5"` = Q4_K_M) |
| `kvPrecision` | string | KV cache precision in bits — `"16"` \| `"8"` \| `"4"` |
| `context` | string | Context length, tokens |
| `batchSize` | string | Batch size |
| `overhead` | string | Memory overhead % |
| `gpuModel` | string | GPU spec key (e.g. `"H100-80"`, or `"custom"`) |
| `customVram` | string | Custom GPU VRAM (GB) |
| `gpuPerServer` | string | GPUs per server |
| `numServers` | string | Number of servers |
| `servingMode` | string | `"monolithic"` \| `"disaggregated"` |
| `tpSize` | string | Tensor-parallel size |
| `ppSize` | string | Pipeline-parallel size |
| `cloudProvider` | string | Cloud pricing provider key (`Lambda`, `RunPod`, `Vast.ai`, `CoreWeave`) |
| `apiProvider` | string | API pricing provider key (`openrouter`, `together`, `fireworks`) |
| `servingEngine` | string | `"raw"` \| `"vllm"` \| `"sglang"` \| `"tgi"` |
| `vllmBlockSize` | string | vLLM paged-attention block size |
| `vllmMaxNumBatchedTokens` | string | vLLM max batched tokens |
| `vllmMaxNumSeqs` | string | vLLM max sequences |
| `tgiMaxBatchSize` | string | TGI max batch size |
| `tgiMaxWaitingSeqs` | string | TGI max waiting sequences |
| `tgiMaxTotalTokens` | string | TGI max total tokens |
| `sglangCacheHitRate` | string | SGLang prefix-cache hit rate (0–1) |
| `sglangPrefixCacheSize` | string | SGLang prefix cache size (GB) |
| `sglangRadixTreeOverhead` | string | SGLang radix-tree overhead multiplier |
| `numExperts` | string | MoE expert count |
| `topK` | string | MoE top-k |
| `epSize` | string | Expert-parallel size |
| `allToAllOverhead` | string | All-to-all overhead |
| `loadBalancePenalty` | string | Load-balance penalty % |
| `nvlinkTopo` | string | NVLink topology key (e.g. `"nvlink-900"`) |
| `nvlinkIntraNodeBw` | string | Intra-node NVLink bandwidth (GB/s) |
| `nvlinkInterNodeBw` | string | Inter-node bandwidth (GB/s) |
| `tpCrossNode` | string | TP node placement — `"auto"` \| `"same-node"` \| `"cross-node"` |
| `ppCrossNode` | string | PP node placement — `"auto"` \| `"same-node"` \| `"cross-node"` |
| `scalingModel` | string | Multi-node scaling model key |
| `ncclAllReduceLatencyUs` | string | NCCL all-reduce latency (µs) |
| `ncclBwUtil` | string | NCCL bandwidth utilization (0–1) |
| `pipelineBubblePct` | string | Pipeline bubble % |
| `promptLen` | string | Prompt length, tokens |
| `prefillComputeEff` | string | Prefill compute efficiency (0–1) |
| `prefillBatchSize` | string | Prefill batch size |
| `enableSpec` | **boolean** | Speculative decoding enabled |
| `specDraftTokens` | string | Draft tokens per step |
| `specAcceptRate` | string | Draft acceptance rate (0–1) |
| `specDraftRatio` | string | Draft:target ratio (0–1) |
| `specDraftOverhead` | string | Draft overhead (0–1) |
| `specSharedGPU` | **boolean** | Draft model shares the target GPU |
| `maxConcurrentUsers` | string | Concurrent user count |
| `targetP50Latency` | string | Target p50 latency |
| `targetP95Latency` | string | Target p95 latency |
| `queueDepthMultiplier` | string | Queue-depth multiplier |
| `bandwidthUtilizationLimit` | string | Bandwidth utilization limit (0–1) |

> The list above is generated from `getConfig()` in `cluster-estimator.html`.
> If the tool grows new inputs, this table grows with it; the regression
> harness roundtrip test keeps the count honest.

### Example document

```json
{
  "preset": "deepseek-v3",
  "params": "671.0",
  "arch": "moe",
  "activeParams": "37.0",
  "nLayers": "61.0",
  "nKvHeads": "1.0",
  "headDim": "576.0",
  "hiddenSize": "7168.0",
  "quant": "4.5",
  "kvPrecision": "16",
  "context": "32768",
  "batchSize": "1",
  "overhead": "10",
  "gpuModel": "H100-80",
  "customVram": "80",
  "gpuPerServer": "8",
  "numServers": "1",
  "servingMode": "monolithic",
  "tpSize": "8",
  "ppSize": "1",
  "cloudProvider": "RunPod",
  "apiProvider": "openrouter",
  "servingEngine": "vllm",
  "vllmBlockSize": "16",
  "vllmMaxNumBatchedTokens": "8192",
  "vllmMaxNumSeqs": "256",
  "tgiMaxBatchSize": "128",
  "tgiMaxWaitingSeqs": "20",
  "tgiMaxTotalTokens": "20000",
  "sglangCacheHitRate": "0.5",
  "sglangPrefixCacheSize": "0",
  "sglangRadixTreeOverhead": "1.0",
  "numExperts": "256",
  "topK": "6",
  "epSize": "1",
  "allToAllOverhead": "5",
  "loadBalancePenalty": "10",
  "nvlinkTopo": "nvlink-900",
  "nvlinkIntraNodeBw": "900",
  "nvlinkInterNodeBw": "50",
  "tpCrossNode": "auto",
  "ppCrossNode": "auto",
  "scalingModel": "ideal",
  "ncclAllReduceLatencyUs": "5",
  "ncclBwUtil": "0.8",
  "pipelineBubblePct": "5",
  "promptLen": "4096",
  "prefillComputeEff": "0.5",
  "prefillBatchSize": "64",
  "enableSpec": false,
  "specDraftTokens": "4",
  "specAcceptRate": "0.8",
  "specDraftRatio": "0.1",
  "specDraftOverhead": "0.15",
  "specSharedGPU": true,
  "maxConcurrentUsers": "100",
  "targetP50Latency": "0.15",
  "targetP95Latency": "1.0",
  "queueDepthMultiplier": "1.5",
  "bandwidthUtilizationLimit": "0.9"
}
```

(Field values above are illustrative; the tool accepts any string/number
combination and sanitizes on restore.)

---

## 4. Iframe embedding

The tool runs entirely in the browser and makes no same-origin assumptions, so
it can be embedded in any page:

```html
<iframe
  src="https://your-host.example/cluster-estimator.html"
  width="100%"
  height="900"
  title="Inference Cluster Estimator"
></iframe>
```

Recommendations:

- **Use the standalone build for embeds when possible** —
  `dist/inference-estimator-standalone.html` inlines the full 60-model library
  and makes zero network requests, so it works over any transport, from
  `file://`, and behind strict CSPs. The regular `cluster-estimator.html`
  fetches `models/*.json` at runtime and needs an HTTP server.
- **There is no postMessage API.** The page neither sends nor listens for
  `postMessage` messages, so parent pages cannot drive it programmatically.
  If you need to push a configuration into the iframe, write the child's hash
  (see below), or pre-build the URL with a hash you generated.
- **Share links work inside iframes.** The hash is per-document, so a link
  with a config fragment restores normally in an embedded frame.
- **localStorage caveat.** "Save to Browser" stores under the key
  `cluster-estimator-config` in the **origin** of the embedded document. If
  the iframe is same-origin with the parent page, both share that store; if
  cross-origin, the frame's store is isolated. Hash links and JSON
  export/import are unaffected by origin.
- **Clipboard.** The 🔗 Copy Link button uses the async Clipboard API, which
  requires a secure context (HTTPS). On plain-HTTP origins the button reports
  "Copy failed"; the hash is still written to the URL, so the user can copy
  the address bar manually.

### Pushing a config into an embedded iframe

Because the iframe reacts to `hashchange`, you can set its config from the
parent (same-origin only; cross-origin iframes are not scriptable):

```js
// same-origin parent → child
const cfg = { params: "70.0", quant: "4.5", context: "32768" };
const frame = document.getElementById('estimator');
frame.contentWindow.location.hash = btoa(JSON.stringify(cfg));
```

Cross-origin: the only supported channel is a URL the parent navigates the
frame to, e.g. `https://host/cluster-estimator.html#<base64>`.

---

## 5. localStorage persistence (for reference)

Independent of the URL/JSON channels, "Save to Browser" writes the same config
object to `localStorage['cluster-estimator-config']` and "Load from Browser"
restores it. On page load a saved config is restored first, then a present URL
hash overrides it. There is no expiry; clearing the site's storage removes it.
