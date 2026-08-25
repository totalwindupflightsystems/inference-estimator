'use strict';
/**
 * IE-GAP-038 — Real-browser Playwright smoke test for cluster-estimator.html.
 *
 * Why this exists: jsdom (test.js) parses HTML but renders no layout, so a
 * regression that hides/breaks the Results panel (display:none, CSS breakage,
 * fetch-path failures for ./models/*.json) ships green under `node test.js`.
 * This harness serves the repo root over a local HTTP server (file:// breaks
 * the model-library fetches with CORS errors), drives headless Chromium, and
 * asserts the KNOWN-ANSWER scenario from docs/QUICKSTART.md:
 *   DeepSeek V3 preset, H100, TP=8 (all other defaults)
 *     -> Model Memory ~23.9 GB, GPUs Needed = 8
 *
 * Negative-proof hook (not used by `npm test`): set IE_BROWSER_TEST_URL to a
 * full URL (e.g. a deliberately broken copy of the page served elsewhere) to
 * point this test at it — every assertion below must then FAIL.
 *
 * Run: node test-browser.js   (after `node test.js`, chained in package.json)
 */

const http = require('http');
const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');

const REPO_ROOT = __dirname;
const PAGE_PATH = '/cluster-estimator.html';
const EXPECTED_MODEL_COUNT = 60; // models/index.json manifest entries

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.webmanifest': 'application/manifest+json',
};

/** Minimal static file server rooted at REPO_ROOT (ephemeral port). */
function startStaticServer(rootDir) {
  return new Promise((resolve, reject) => {
    const server = http.createServer((req, res) => {
      let pathname;
      try {
        pathname = decodeURIComponent(new URL(req.url, 'http://127.0.0.1').pathname);
      } catch (e) {
        res.writeHead(400).end('bad request');
        return;
      }
      if (pathname === '/') pathname = '/index.html';
      let filePath = path.normalize(path.join(rootDir, pathname));
      if (filePath !== rootDir && !filePath.startsWith(rootDir + path.sep)) {
        res.writeHead(403).end('forbidden');
        return;
      }
      fs.stat(filePath, (err, st) => {
        if (!err && st.isDirectory()) filePath = path.join(filePath, 'index.html');
        fs.readFile(filePath, (err2, data) => {
          if (err2) {
            res.writeHead(404, { 'Content-Type': 'text/plain' }).end('404 Not Found: ' + pathname);
            return;
          }
          const ext = path.extname(filePath).toLowerCase();
          res.writeHead(200, { 'Content-Type': MIME_TYPES[ext] || 'application/octet-stream' });
          res.end(data);
        });
      });
    });
    server.on('error', reject);
    server.listen(0, '127.0.0.1', () => resolve({ server, port: server.address().port }));
  });
}

// --- Tiny TAP-ish reporter -------------------------------------------------
const failures = [];
let passed = 0;
function ok(msg) {
  passed += 1;
  console.log('    ok - ' + msg);
}
function fail(msg) {
  failures.push(msg);
  console.error('    FAIL - ' + msg);
}
/** Visibility per CSSOM: attached, not display:none/visibility:hidden, non-zero box. */
async function isVisibleWithBox(page, selector) {
  return page.evaluate((sel) => {
    const el = document.querySelector(sel);
    if (!el) return { found: false };
    const style = getComputedStyle(el);
    const rect = el.getBoundingClientRect();
    return {
      found: true,
      displayed: style.display !== 'none',
      cssVisible: style.visibility !== 'hidden' && style.visibility !== 'collapse',
      boxHeight: rect.height,
      boxWidth: rect.width,
    };
  }, selector);
}

async function main() {
  const targetOverride = process.env.IE_BROWSER_TEST_URL; // negative-proof hook
  const { server, port } = await startStaticServer(REPO_ROOT);
  let browser;
  try {
    browser = await chromium.launch();
    const context = await browser.newContext();
    // Hermetic runs: never let the app's service worker cache/stale-serve pages.
    await context.addInitScript(() => {
      try {
        if (navigator.serviceWorker) {
          navigator.serviceWorker.register = () => Promise.resolve();
          navigator.serviceWorker.getRegistrations = async () => [];
        }
      } catch (e) { /* older engines */ }
    });
    const page = await context.newPage();
    const pageErrors = [];
    page.on('pageerror', (e) => pageErrors.push(String(e && e.message)));

    const url = targetOverride || `http://127.0.0.1:${port}${PAGE_PATH}`;
    console.log(`[test-browser] serving ${REPO_ROOT} on http://127.0.0.1:${port}`);
    console.log(`[test-browser] loading ${url} in headless Chromium`);

    // -- 1. Page loads over HTTP --------------------------------------------
    const resp = await page.goto(url, { waitUntil: 'load', timeout: 30000 });
    if (!resp || !resp.ok()) {
      fail(`cluster-estimator.html loads over HTTP (status ${resp ? resp.status() : 'no-response'})`);
    } else {
      ok(`cluster-estimator.html loads over HTTP (HTTP ${resp.status()})`);
    }

    // -- 2. Model library fetched + rendered (60 presets in the dropdown) ---
    // loadModelLibrary() swaps the embedded fallbacks for the 60-model
    // library and calls refreshModelUI(); a broken ./models fetch path leaves
    // the dropdown at the fallback size. Wait, then measure the DOM.
    const waitErr = await page
      .waitForFunction(
        (expectedOptions) =>
          document.querySelectorAll('#modelPreset option').length === expectedOptions,
        EXPECTED_MODEL_COUNT + 1, // + placeholder "-- Select preset --"
        { timeout: 15000 },
      )
      .then(() => null)
      .catch((e) => e);
    const optionCount = await page.locator('#modelPreset option').count();
    if (waitErr) {
      fail(`model library rendered: #modelPreset has ${EXPECTED_MODEL_COUNT} presets + placeholder (got ${optionCount} options${waitErr.message ? '; ' + waitErr.message.split('\n')[0] : ''})`);
    } else {
      ok(`model library rendered: #modelPreset has ${EXPECTED_MODEL_COUNT} presets + placeholder (${optionCount} options)`);
    }

    // -- 3. Drive the known-answer scenario (QUICKSTART worked example) -----
    // Defaults already match the doc except Tensor Parallel Size = 8.
    // fill() fires `input`; blur() lets the browser fire the native `change`
    // event the page listens on (recalculate() is wired to `change`).
    await page.fill('#tpSize', '8');
    await page.locator('#tpSize').blur();
    await page.selectOption('#modelPreset', 'deepseek-v3'); // change -> applyPreset() -> recalculate()

    // -- 4. Results panel VISIBILITY (layout, not just presence) ------------
    const vis = await isVisibleWithBox(page, '#resultsContainer');
    if (!vis.found) fail('#resultsContainer exists in the DOM');
    else if (!vis.displayed) fail('#resultsContainer is visible (display:none computed) — panel hidden?');
    else if (!vis.cssVisible) fail('#resultsContainer is visible (visibility:hidden)');
    else if (!(vis.boxHeight > 0)) fail(`#resultsContainer is visible and rendered with non-zero layout box (height=${vis.boxHeight})`);
    else ok(`#resultsContainer is visible and rendered (layout box ${vis.boxWidth}x${vis.boxHeight}px)`);

    // Rendered numbers settle synchronously after recalculate(); poll briefly
    // so a slow frame never flakes the run.
    await page
      .waitForFunction(
        () => document.getElementById('rModelMem').textContent.trim() !== '—',
        null,
        { timeout: 5000 },
      )
      .catch(() => {});

    // -- 5. Known-answer values (docs/QUICKSTART.md worked example) ---------
    const modelMem = parseFloat(await page.textContent('#rModelMem'));
    if (Number.isFinite(modelMem) && Math.abs(modelMem - 23.9) <= 0.15) {
      ok(`DeepSeek V3 Model Memory ~23.9 GB (got ${modelMem.toFixed(1)} GB)`);
    } else {
      fail(`DeepSeek V3 Model Memory ~23.9 GB (got ${await rawText(page, '#rModelMem')})`);
    }

    const gpusRaw = (await page.textContent('#rGpusNeeded')).trim();
    if (/^8$/.test(gpusRaw)) {
      ok('DeepSeek V3 @ TP=8 GPUs Needed = 8');
    } else {
      fail(`DeepSeek V3 @ TP=8 GPUs Needed = 8 (got "${gpusRaw}")`);
    }

    // Every metric tile must hold rendered output (not the em-dash empty state).
    const emptyTiles = await page.evaluate(() =>
      Array.from(document.querySelectorAll('#resultsContainer .metric .value'))
        .filter((el) => el.textContent.trim() === '' || el.textContent.trim() === '—')
        .map((el) => el.id),
    );
    if (emptyTiles.length > 0) {
      fail(`Results panel fully rendered — all metric tiles populated (empty: ${emptyTiles.join(', ')})`);
    } else {
      ok('Results panel fully rendered — all metric tiles populated');
    }

    // -- 6. No uncaught page errors during load/interaction -----------------
    if (pageErrors.length > 0) {
      fail(`no uncaught page errors (got ${pageErrors.length}: ${pageErrors.slice(0, 3).join(' | ')})`);
    } else {
      ok('no uncaught page errors during load + interaction');
    }

    console.log(
      `\n[test-browser] ${passed} check(s) passed, ${failures.length} failed` +
        (failures.length ? ':\n  - ' + failures.join('\n  - ') : ''),
    );
    process.exitCode = failures.length > 0 ? 1 : 0;
  } finally {
    if (browser) await browser.close().catch(() => {});
    server.close();
  }
}

async function rawText(page, selector) {
  return `"${(await page.textContent(selector)).trim()}"`;
}

main().catch((err) => {
  console.error('[test-browser] FATAL: ' + (err && err.stack ? err.stack : err));
  process.exitCode = 1;
});
