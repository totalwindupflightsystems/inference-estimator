
## Dogfood Findings (2026-09-01)
Verdict: SHIPPABLE
Promise: {"entry_point":"cluster-estimator.html — a single-file static HTML page (HTML+CSS+JS, zero dependencies) opened in a browser via file://, any HTTP server, or GitHub Pages; no CLI binary, no HTTP server app, no library, no MCP, no cron.","promise":"This project claims a user can size an LLM inference

- [P2] Docs don't cover port collisions — Documented 'python3 -m http.server 8000' fails when 8000 is taken (uvicorn here; 8765 also occupied by chimera). No docs mention choosing an alternate port — cost a few minutes of trial-and-error plus
- [P2] Docs labels differ from actual dropdown labels — Serving engine option is 'vLLM (paged attention)' not 'vLLM'; cloud provider is 'Lambda Labs' not 'Lambda'. Judge had to read the DOM to find exact labels. Presets still auto-fill correctly, so this o
- [P2] file:// embedded-fallback notice is console-only — Docs say 'a console warning explains this', but the offline-toast only fires when navigator.onLine is false. An online user opening the file via file:// silently runs on embedded fallback data with ze
