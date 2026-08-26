# Contributing

Thanks for your interest in contributing to the Inference Cluster Estimator!

## Project Structure

- `cluster-estimator.html` — Single-file application (HTML + CSS + JS)
- `models/` — Per-model JSON library (60 models + index.json)
- `docs/` — Formula reference, quick-start, input glossary
- `test.js` — Node regression harness (presets/roundtrip/edge cases)
- `test-browser.js` — Real-browser Playwright harness (7 headless-Chromium checks)
- `specs/` — Implementation specifications
- `.coding-hermes/board/` — Live task board (JSONL canonical: tasks.jsonl + events.jsonl + schema.sql; board.db and *.parquet are gitignored rebuildable caches)

## Development

1. Fork the repo
2. Make changes to `cluster-estimator.html`
3. Open `cluster-estimator.html` in a browser to test
4. Run the regression harness (see Testing below)
5. Submit a PR

## Testing

`npm test` runs two harnesses:

- `test.js` — Node regression harness covering 15 jsdom groups: 60 preset applications, JSON export/import roundtrip, edge cases, GAP regressions, math known-answers, docs consistency, dist freshness, board evidence, and recent feature regressions (~6s).
- `test-browser.js` — real-browser Playwright suite: 7 headless-Chromium checks against the built standalone bundle served over a local HTTP server (file:// fetch fails CORS), covering load, model-library rendering, live calculation, and uncaught-error detection (~3-4s).

On a fresh clone, three prerequisites must be met before `npm test` goes green:

```bash
npm install                            # one-time (devDependencies: jsdom, playwright)
node scripts/build-standalone.js       # dist/ is gitignored build output; test.js group 9 (Dist freshness) FAILs without it
npx playwright install chromium        # test-browser.js crashes with "Executable doesn't exist" without it
npm test                               # runs test.js (15 groups, ~6s) && test-browser.js (7 checks, ~3-4s) — ~10s total
```

- Full git history is also required: test.js group 10 (Board evidence) resolves each complete row's commit_hash via `git cat-file`, which FAILs on shallow clones — clone with `--depth 0` / `fetch-depth: 0` (CI does).

Requires Node 22 (CI pins it via actions/setup-node).

## Code Style

- Keep everything in the single HTML file
- Follow existing JS patterns (no framework)
- Use the existing CSS variables and `.notes` class conventions

## Commit Convention

Commits must include `Co-authored-by: Alexis Okuwa <wojonstech@gmail.com>`.
