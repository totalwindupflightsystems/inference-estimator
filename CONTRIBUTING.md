# Contributing

Thanks for your interest in contributing to the Inference Cluster Estimator!

## Project Structure

- `cluster-estimator.html` — Single-file application (HTML + CSS + JS)
- `models/` — Per-model JSON library (42 models + index.json)
- `docs/` — Formula reference, quick-start, input glossary
- `test.js` — Node regression harness (presets/roundtrip/edge cases)
- `specs/` — Implementation specifications
- `.coding-hermes/board/` — Live task board (DuckDB v2: schema.sql, tasks.parquet, events.parquet)

## Development

1. Fork the repo
2. Make changes to `cluster-estimator.html`
3. Open `cluster-estimator.html` in a browser to test
4. Submit a PR

## Code Style

- Keep everything in the single HTML file
- Follow existing JS patterns (no framework)
- Use the existing CSS variables and `.notes` class conventions

## Commit Convention

Commits must include `Co-authored-by: Alexis Okuwa <wojonstech@gmail.com>`.
