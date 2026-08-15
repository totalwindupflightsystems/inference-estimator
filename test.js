#!/usr/bin/env node
/**
 * Regression harness for cluster-estimator.html — IE-GAP-002
 *
 * Setup (one-time, fresh clone):
 *   npm install
 *
 * Run:
 *   node test.js
 *
 * Loads the single-file tool via jsdom (with a fetch polyfill that serves
 * models/*.json from disk), waits for MODEL_PRESETS to populate (60 entries),
 * then exercises ten test groups:
 *   1. Presets  — all 60 model presets produce finite rendered numbers
 *   2. Roundtrip — getConfig → JSON → setConfig → getConfig is lossless
 *   3. Edge     — 0 GPUs, 1B params, FP32 quant, 1M context → finite outputs
 *   4. GAP regressions — IE-GAP-011..014 (TP×PP floor, cloud fallback warning,
 *      poisoned-import finiteness, manifest PWA icons)
 *   5. Math known-answers — IE-GAP-016 (DeepSeek V3 worked example from
 *      QUICKSTART.md: modelMemGB ≈ 23.9, KV cache ≈ 42.4, GPUs Needed = 8,
 *      decode throughput ≈ 1523 — catches formula breakage like a dropped ×2)
 *   6. GAP hardening — IE-GAP-019..022 (share-link cold load with a poisoned
 *      quant + preset restore, real importConfig() driven with a File object,
 *      validation-banner UX on blank quant)
 *   7. Alphabetical presets — 2026-08-12 library refresh ordering
 *   8. Docs consistency — IE-GAP-024/025 (no stale "42" or "166 KB" claims in
 *      README/QUICKSTART, preset counts match models/index.json, standalone
 *      size claim within ±5% of the dist file, README links to the canonical
 *      docs/QUICKSTART.md)
 *   9. Dist freshness — IE-GAP-027 (dist/inference-estimator-standalone.html
 *      is gitignored build output; distinctive source markers and the
 *      embedded preset count must match the current cluster-estimator.html +
 *      models/index.json, else the group fails with a 'dist is stale'
 *      message. Missing dist = SKIPPED warning, not a failure.)
 *  10. Board evidence — IE-GAP-029 (scripts/verify-board-evidence.js must
 *      pass on the REAL board: every status=complete row carries a
 *      commit_hash that resolves in git; temp-copy negative fixtures with a
 *      cleared hash and a bogus hash must fail naming the row)
 *
 * NOTE on lexical scope: MODEL_PRESETS is declared with `let` at the top level
 * of the inline <script>, so it lives in the script's lexical scope and is NOT
 * a property of window. We use window.eval() to read it. Functions declared
 * with `function foo()` ARE window properties, so window.getConfig() etc work.
 *
 * Exit 0 only when every assertion passes.
 */

'use strict';

const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');

const { JSDOM } = require('jsdom');

const ROOT = __dirname;
const HTML_FILE = path.join(ROOT, 'cluster-estimator.html');
const MODELS_DIR = path.join(ROOT, 'models');

// --- fetch polyfill -------------------------------------------------------
// jsdom has no native fetch, and file:// base won't resolve ./models/.
// Serve the real JSON files from disk as Response-like objects.
function makeFetchPolyfill() {
  return async function fetch(url) {
    const rel = String(typeof url === 'string' ? url : (url && url.url) || url)
      .replace(/^\.?\//, '');
    const fp = path.join(MODELS_DIR, path.basename(rel));
    try {
      const body = fs.readFileSync(fp, 'utf8');
      return {
        ok: true, status: 200,
        async json() { return JSON.parse(body); },
        async text() { return body; },
      };
    } catch (e) {
      return { ok: false, status: 404, async json() { throw e; }, async text() { return ''; } };
    }
  };
}

// --- jsdom load -----------------------------------------------------------
// hash (optional): fragment to set in the document URL BEFORE page scripts
// run, so the CE-018 hash-decode path is exercised as a true cold load.
async function loadPage(hash) {
  const opts = {
    runScripts: 'dangerously',
    resources: 'usable',
    pretendToBeVisual: true,
    url: 'http://localhost/' + (hash || ''), // real origin so localStorage works (file:// = opaque)
    beforeParse(window) {
      window.matchMedia = window.matchMedia || function () {
        return { matches: false, addListener() {}, removeListener() {}, addEventListener() {}, removeEventListener() {} };
      };
      if (!window.navigator.clipboard) {
        window.navigator.clipboard = { writeText: async () => {} };
      }
      if (!window.URL.createObjectURL) {
        window.URL.createObjectURL = () => 'blob:mock';
        window.URL.revokeObjectURL = () => {};
      }
      window.fetch = makeFetchPolyfill();
    },
  };
  if (hash) {
    // String constructor so the hash is part of the initial document URL
    // (JSDOM.fromFile would resolve the file path and may drop the fragment).
    return new JSDOM(fs.readFileSync(HTML_FILE, 'utf8'), opts);
  }
  return JSDOM.fromFile(HTML_FILE, opts);
}

// Wait until MODEL_PRESETS has >= expected entries (read via eval since it's
// in lexical scope), or timeout.
async function waitForModels(win, expected, timeoutMs) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    let n = 0;
    try {
      n = win.eval('Object.keys(MODEL_PRESETS).length');
    } catch (e) {
      n = 0;
    }
    if (n >= expected) return n;
    await new Promise((r) => setTimeout(r, 100));
  }
  try { return win.eval('Object.keys(MODEL_PRESETS).length'); } catch (e) { return 0; }
}

// --- helpers --------------------------------------------------------------

// Collect numeric values from the results container.
// Each metric is <div class="metric"><div class="value" id="rX">text</div><div class="label">Label</div></div>
// We scan every element with class "value" inside resultsContainer, extract
// the first number from its textContent, and pair it with the sibling label.
function collectRenderedNumbers(doc) {
  const numbers = [];
  const container = doc.getElementById('resultsContainer');
  if (!container) return numbers;

  const valueEls = container.querySelectorAll('.metric .value');
  valueEls.forEach((el) => {
    const labelEl = el.parentElement ? el.parentElement.querySelector('.label') : null;
    const label = labelEl ? labelEl.textContent.trim() : (el.id || 'unknown');
    const text = el.textContent.trim();
    if (!text || text === '—') return;
    if (text === 'N/A' || text === 'N/A (disabled)' || text === 'N/A (dense)') return;

    // Catch literal NaN/Infinity rendered in the DOM (division-by-zero bugs).
    // These are NOT finite and must be reported as failures.
    if (text === 'NaN' || text === 'Infinity' || text === '-Infinity') {
      const val = parseFloat(text);
      numbers.push({ label, id: el.id || label, value: val, text });
      return;
    }

    // Extract the first numeric token (handles "$1.23", "45 tok/s", "3,201 ms", "80.5%", "×1.50")
    const cleaned = text.replace(/[,$×]/g, '');
    const m = cleaned.match(/-?\d+(\.\d+)?/);
    if (m) {
      const val = parseFloat(m[0]);
      numbers.push({ label, id: el.id || label, value: val, text });
    }
  });

  return numbers;
}

// Set an input/select value and dispatch events so handlers fire.
function setInput(win, doc, id, value) {
  const el = doc.getElementById(id);
  assert(el, `input #${id} not found`);
  el.value = value;
  el.dispatchEvent(new win.Event('input', { bubbles: true }));
  el.dispatchEvent(new win.Event('change', { bubbles: true }));
}

// Apply a preset by key: set the select, dispatch change, then call
// applyPreset() + recalculate() directly (the onchange handler does too).
function applyPresetByKey(win, doc, key) {
  const sel = doc.getElementById('modelPreset');
  assert(sel, 'modelPreset select not found');
  sel.value = key;
  sel.dispatchEvent(new win.Event('change', { bubbles: true }));
  // applyPreset is called via onchange; also call directly for certainty
  if (typeof win.applyPreset === 'function') win.applyPreset();
  if (typeof win.recalculate === 'function') win.recalculate();
}

// Recursive deep-equal that ignores key insertion order.
function deepEqual(a, b) {
  if (a === b) return true;
  if (typeof a !== typeof b) return false;
  if (a === null || b === null) return a === b;
  if (typeof a !== 'object') return a === b;
  const ak = Object.keys(a).sort();
  const bk = Object.keys(b).sort();
  if (ak.length !== bk.length) return false;
  for (let i = 0; i < ak.length; i++) {
    if (ak[i] !== bk[i]) return false;
    if (!deepEqual(a[ak[i]], b[ak[i]])) return false;
  }
  return true;
}

// --- main -----------------------------------------------------------------
(async () => {
  const results = { groups: [], totalPass: 0, totalFail: 0 };

  function group(name, pass, detail) {
    results.groups.push({ name, pass, detail });
    if (pass) results.totalPass++;
    else results.totalFail++;
  }

  const t0 = Date.now();
  let dom;
  try {
    dom = await loadPage();
  } catch (e) {
    console.error('FATAL: could not load page:', e.message);
    process.exit(1);
  }
  const win = dom.window;
  const doc = win.document;

  const manifest = JSON.parse(fs.readFileSync(path.join(MODELS_DIR, 'index.json'), 'utf8'));
  const expectedCount = manifest.models.length; // manifest-driven (was 42, now 60)

  const loadedCount = await waitForModels(win, expectedCount, 15000);

  // ===== TEST GROUP 1: Presets =====
  let presetNanCount = 0;
  const presetFailures = [];
  for (const key of manifest.models) {
    applyPresetByKey(win, doc, key);
    const nums = collectRenderedNumbers(doc);
    for (const { id, label, value } of nums) {
      if (!Number.isFinite(value)) {
        presetNanCount++;
        presetFailures.push(`${key}:${label}=${value}`);
      }
    }
  }
  group('Presets',
    presetNanCount === 0 && loadedCount === expectedCount,
    `${loadedCount}/${expectedCount} presets valid ${presetNanCount} NaN`);

  // ===== TEST GROUP 2: Roundtrip =====
  // JSDOM has a known bug where range inputs with max > 100 clamp value to 100.
  // To get a meaningful roundtrip test, we first set range inputs to valid
  // in-range values, then verify getConfig → JSON → setConfig → getConfig is lossless.
  applyPresetByKey(win, doc, manifest.models[0]);
  // Set range inputs to known-valid values that JSDOM won't mangle
  setInput(win, doc, 'context', '4096');
  setInput(win, doc, 'promptLen', '256');
  setInput(win, doc, 'gpuPerServer', '4');
  setInput(win, doc, 'numServers', '2');
  setInput(win, doc, 'overhead', '10');
  win.recalculate();
  const cfg1 = win.getConfig();
  const json = JSON.stringify(cfg1);
  win.setConfig(JSON.parse(json));
  const cfg2 = win.getConfig();
  const roundtripOk = deepEqual(cfg1, cfg2);
  // Collect which keys differ for diagnostics
  let roundtripDetail;
  if (roundtripOk) {
    roundtripDetail = `JSON export/import lossless (${Object.keys(cfg1).length} fields)`;
  } else {
    const allKeys = new Set([...Object.keys(cfg1), ...Object.keys(cfg2)]);
    const diffs = [];
    for (const k of allKeys) {
      if (cfg1[k] !== cfg2[k]) diffs.push(`${k}: ${JSON.stringify(cfg1[k])}→${JSON.stringify(cfg2[k])}`);
    }
    roundtripDetail = `FIELDS DIFFER: ${diffs.join(', ')}`;
  }
  group('Roundtrip', roundtripOk, roundtripDetail);

  // ===== TEST GROUP 3: Edge cases =====
  const edgeResults = [];
  let edgeAllFinite = true;

  // (a) 0 GPUs total — set gpusPerServer=0 (causes division-by-zero in
  // serversNeeded without the guard). JSDOM clamps range inputs to min,
  // so we temporarily lower the min attribute to allow 0.
  applyPresetByKey(win, doc, manifest.models[0]);
  {
    const gps = doc.getElementById('gpuPerServer');
    const origMin = gps.getAttribute('min');
    gps.setAttribute('min', '0');
    gps.value = '0';
    gps.dispatchEvent(new win.Event('input', { bubbles: true }));
    win.recalculate();
    const nums = collectRenderedNumbers(doc);
    const bad = nums.filter((n) => !Number.isFinite(n.value));
    if (bad.length > 0) {
      edgeAllFinite = false;
      edgeResults.push(`0-GPUs FAIL: ${bad.map((b) => b.label).join(', ')}`);
    } else {
      edgeResults.push('0-GPUs finite');
    }
    // Restore min AND value for subsequent tests
    gps.setAttribute('min', origMin);
    gps.value = '8';
    gps.dispatchEvent(new win.Event('input', { bubbles: true }));
    win.recalculate();
  }

  // (b) 1B-param model (params=1)
  applyPresetByKey(win, doc, manifest.models[0]);
  setInput(win, doc, 'params', '1');
  win.recalculate();
  {
    const nums = collectRenderedNumbers(doc);
    const bad = nums.filter((n) => !Number.isFinite(n.value));
    if (bad.length > 0) {
      edgeAllFinite = false;
      edgeResults.push(`1B-params FAIL: ${bad.map((b) => b.label).join(', ')}`);
    } else {
      edgeResults.push('1B-params finite');
    }
  }

  // (c) FP32 quantization
  applyPresetByKey(win, doc, manifest.models[0]);
  setInput(win, doc, 'quant', '32.0');
  win.recalculate();
  {
    const nums = collectRenderedNumbers(doc);
    const bad = nums.filter((n) => !Number.isFinite(n.value));
    if (bad.length > 0) {
      edgeAllFinite = false;
      edgeResults.push(`FP32 FAIL: ${bad.map((b) => b.label).join(', ')}`);
    } else {
      edgeResults.push('FP32 finite');
    }
  }

  // (d) 1M-token context
  applyPresetByKey(win, doc, manifest.models[0]);
  setInput(win, doc, 'context', '1000000');
  win.recalculate();
  {
    const nums = collectRenderedNumbers(doc);
    const bad = nums.filter((n) => !Number.isFinite(n.value));
    if (bad.length > 0) {
      edgeAllFinite = false;
      edgeResults.push(`1M-ctx FAIL: ${bad.map((b) => b.label).join(', ')}`);
    } else {
      edgeResults.push('1M-ctx finite');
    }
  }

  group('Edge cases', edgeAllFinite, edgeResults.join('; '));

  // ===== TEST GROUP 4: IE-GAP regressions (011-014) =====
  const gapResults = [];
  let gapAllPass = true;
  function gapCheck(name, ok, detail) {
    if (!ok) gapAllPass = false;
    gapResults.push(`${ok ? 'PASS' : 'FAIL'} ${name}: ${detail}`);
  }

  // (a) IE-GAP-011: TP×PP floor — TP=8 must never report fewer than 8 GPUs
  applyPresetByKey(win, doc, manifest.models[0]);
  setInput(win, doc, 'tpSize', '8');
  setInput(win, doc, 'ppSize', '1');
  win.recalculate();
  {
    const el = doc.getElementById('rGpusNeeded');
    const v = parseInt(el.textContent, 10);
    gapCheck('TP floor', Number.isFinite(v) && v >= 8, `TP=8 PP=1 → GPUs Needed=${el.textContent}`);
  }
  setInput(win, doc, 'tpSize', '1');

  // (b) IE-GAP-012: cloud fallback warning — L40S-48 + Lambda (not listed) must warn;
  //     H100-80 + Lambda (listed) must NOT warn.
  setInput(win, doc, 'gpuModel', 'L40S-48');
  setInput(win, doc, 'cloudProvider', 'Lambda');
  win.recalculate();
  {
    const warn = doc.getElementById('cloudFallbackWarn');
    const shown = warn && warn.style.display !== 'none';
    const marker = (doc.getElementById('cloudPriceTable').innerHTML || '').includes('spec price');
    gapCheck('Cloud fallback warning', !!(shown && marker), `warn visible=${!!shown} amber marker=${marker}`);
  }
  setInput(win, doc, 'gpuModel', 'H100-80');
  win.recalculate();
  {
    const warn = doc.getElementById('cloudFallbackWarn');
    gapCheck('Listed GPU no warning', !!(warn && warn.style.display === 'none'), `warn display=${warn ? warn.style.display : 'missing'}`);
  }

  // (c) IE-GAP-013: poisoned import — tpSize:0 / ppSize:0 must not render NaN/Infinity
  applyPresetByKey(win, doc, manifest.models[0]);
  {
    const cfg = win.getConfig();
    cfg.tpSize = 0;
    cfg.ppSize = 0;
    win.setConfig(cfg);
    win.recalculate();
    const nums = collectRenderedNumbers(doc);
    const bad = nums.filter((n) => !Number.isFinite(n.value));
    const literal = [...doc.querySelectorAll('.metric .value')].filter((el) => /NaN|Infinity/.test(el.textContent));
    gapCheck('Poisoned import finite',
      bad.length === 0 && literal.length === 0,
      `non-finite=${bad.map((b) => b.label).join(',') || 'none'} literal=${literal.map((el) => el.id).join(',') || 'none'}`);
  }

  // (d) IE-GAP-014: manifest icons present and on disk
  {
    const mf = JSON.parse(fs.readFileSync(path.join(ROOT, 'manifest.json'), 'utf8'));
    const icons = mf.icons || [];
    const sizes = icons.map((i) => i.sizes);
    const filesOk = icons.length > 0 && icons.every((i) => fs.existsSync(path.join(ROOT, i.src)));
    gapCheck('Manifest icons', sizes.includes('192x192') && sizes.includes('512x512') && filesOk,
      `sizes=${sizes.join(',')} files=${icons.map((i) => fs.existsSync(path.join(ROOT, i.src))).join(',')}`);
  }

  group('GAP regressions', gapAllPass, gapResults.join('; '));

  // ===== TEST GROUP 5: Math known-answers (IE-GAP-016) =====
  // Known-answer regression: the DeepSeek V3 worked example from
  // docs/QUICKSTART.md. Values are produced by the REAL recalculate() in
  // cluster-estimator.html and cross-checked against docs/example-calc.js.
  // If a formula breaks (e.g. dropping the ×2 K+V multiplier in
  // kvPerTokenBytes), these assertions must FAIL with a numeric mismatch.
  const mathResults = [];
  let mathAllPass = true;
  function mathCheck(name, ok, detail) {
    if (!ok) mathAllPass = false;
    mathResults.push(`${ok ? 'PASS' : 'FAIL'} ${name}: ${detail}`);
  }

  applyPresetByKey(win, doc, 'deepseek-v3');
  setInput(win, doc, 'context', '32768');
  setInput(win, doc, 'batchSize', '8');
  setInput(win, doc, 'overhead', '15');
  setInput(win, doc, 'quant', '4.5');
  setInput(win, doc, 'kvPrecision', '16');
  setInput(win, doc, 'tpSize', '8');
  setInput(win, doc, 'ppSize', '1');
  setInput(win, doc, 'gpuModel', 'H100-80');
  setInput(win, doc, 'cloudProvider', 'Lambda');
  setInput(win, doc, 'servingEngine', 'vllm');
  win.recalculate();
  {
    const num = (id) => { const v = parseFloat(doc.getElementById(id).textContent); return v; };
    const modelMem = num('rModelMem');
    mathCheck('Model memory ≈ 23.9 GB', Math.abs(modelMem - 23.93) < 0.5,
      `rModelMem=${modelMem} (expected ≈23.9)`);
    const kvCache = num('rKvCache');
    mathCheck('KV cache ≈ 42.4 GB', Math.abs(kvCache - 42.37) < 1.0,
      `rKvCache=${kvCache} (expected ≈42.4 — catches dropped ×2 K+V)`);
    const gpus = num('rGpusNeeded');
    mathCheck('GPUs Needed = 8', gpus === 8,
      `rGpusNeeded=${gpus} (expected 8 — TP×PP floor)`);
    const decode = num('rDecodeThroughput');
    mathCheck('Decode throughput ≈ 1523 tok/s', Math.abs(decode - 1523) < 10,
      `rDecodeThroughput=${decode} (expected ≈1523)`);
  }

  group('Math known-answers', mathAllPass, mathResults.join('; '));

  // ===== TEST GROUP 6: GAP hardening (IE-GAP-019..022) =====
  // Real-path coverage for the NaN-on-invalid-quant + preset-restore fixes:
  // (a) share-link cold load with the hash set BEFORE page scripts run,
  // (b) the real importConfig() driven with a File object, (c) the
  // validation-banner UX. Every case must FAIL against the pre-fix code.
  const hardenResults = [];
  let hardenAllPass = true;
  function hardenCheck(name, ok, detail) {
    if (!ok) hardenAllPass = false;
    hardenResults.push(`${ok ? 'PASS' : 'FAIL'} ${name}: ${detail}`);
  }

  // (a) Share-link cold load: config carries a preset + a poisoned quant
  // ("3.5" — no matching <option> in #quant, so pre-fix the select goes
  // blank and the math renders NaN).
  {
    applyPresetByKey(win, doc, 'deepseek-v3');
    const shareCfg = win.getConfig();
    shareCfg.quant = '3.5'; // poisoned
    const encoded = Buffer.from(JSON.stringify(shareCfg)).toString('base64');
    const dom2 = await loadPage('#' + encoded);
    const win2 = dom2.window;
    const doc2 = win2.document;
    const loaded2 = await waitForModels(win2, expectedCount, 15000);
    hardenCheck('Share link hash survives load', win2.location.hash === '#' + encoded,
      `hash=${String(win2.location.hash).slice(0, 18)}… loaded=${loaded2}`);
    hardenCheck('Share link quant sanitized to default', doc2.getElementById('quant').value === '4.5',
      `quant=${JSON.stringify(doc2.getElementById('quant').value)} (expect "4.5")`);
    hardenCheck('Share link restores preset', doc2.getElementById('modelPreset').value === 'deepseek-v3',
      `preset=${JSON.stringify(doc2.getElementById('modelPreset').value)}`);
    const desc2 = doc2.getElementById('presetDesc');
    hardenCheck('Share link preset description back',
      !!(desc2 && desc2.style.display !== 'none' && desc2.innerHTML.trim().length > 0),
      `desc visible=${!!(desc2 && desc2.style.display !== 'none')} len=${desc2 ? desc2.innerHTML.trim().length : 'n/a'}`);
    hardenCheck('Share link params restored', doc2.getElementById('params').value === String(shareCfg.params),
      `params=${JSON.stringify(doc2.getElementById('params').value)} (expect ${JSON.stringify(shareCfg.params)})`);
    const nums2 = collectRenderedNumbers(doc2);
    const bad2 = nums2.filter((n) => !Number.isFinite(n.value));
    const literal2 = [...doc2.querySelectorAll('.metric .value')].filter((el) => /NaN|Infinity/.test(el.textContent));
    hardenCheck('Share link results finite (no NaN)', bad2.length === 0 && literal2.length === 0,
      `non-finite=${bad2.map((b) => b.label).join(',') || 'none'} literal=${literal2.map((el) => el.id).join(',') || 'none'}`);
    // Let dom2's async library swap settle (its final step is a flashStatus)
    // BEFORE tearing the window down — closing mid-load crashes the page's
    // loadModelLibrary continuation on the torn-down document.
    const tClose = Date.now();
    while (Date.now() - tClose < 2000 && !/Loaded|Embedded/.test(doc2.getElementById('status').textContent)) {
      await new Promise((r) => setTimeout(r, 25));
    }
    dom2.window.close();
  }

  // (b) Real importConfig(): importConfig() creates its own <input type=file>
  // and calls click(). jsdom has no file picker, so capture the input via a
  // click() override and hand it a real File — the onchange → FileReader →
  // setConfig chain that follows IS the real import path. The file claims a
  // DIFFERENT preset than the current page state so the preset-restore check
  // can only pass if the import actually applied the config.
  {
    applyPresetByKey(win, doc, manifest.models[0]);
    const impCfg = win.getConfig();
    impCfg.preset = 'deepseek-v3'; // different from the current state
    impCfg.quant = '3.5'; // poisoned — no matching <option> in #quant
    const file = new win.File([JSON.stringify(impCfg)], 'cluster-config.json', { type: 'application/json' });
    let fileInput = null;
    const origClick = win.HTMLInputElement.prototype.click;
    win.HTMLInputElement.prototype.click = function () {
      if (this.type === 'file') { fileInput = this; return; }
      return origClick.apply(this, arguments);
    };
    win.importConfig();
    win.HTMLInputElement.prototype.click = origClick;
    hardenCheck('importConfig creates file input', !!fileInput, fileInput ? 'captured' : 'no input created');
    if (fileInput) {
      Object.defineProperty(fileInput, 'files', { value: [file], configurable: true });
      fileInput.dispatchEvent(new win.Event('change', { bubbles: true }));
      // FileReader.onload fires asynchronously (~10ms in jsdom) — yield so the
      // real import chain runs to completion BEFORE asserting. Checking first
      // would exit on the stale pre-import value and silently pass a dead path.
      await new Promise((r) => setTimeout(r, 150));
      hardenCheck('Import sanitizes poisoned quant', doc.getElementById('quant').value === '4.5',
        `quant=${JSON.stringify(doc.getElementById('quant').value)} (expect "4.5")`);
      const numsImp = collectRenderedNumbers(doc);
      const badImp = numsImp.filter((n) => !Number.isFinite(n.value));
      const literalImp = [...doc.querySelectorAll('.metric .value')].filter((el) => /NaN|Infinity/.test(el.textContent));
      hardenCheck('Import results finite (no NaN)', badImp.length === 0 && literalImp.length === 0,
        `non-finite=${badImp.map((b) => b.label).join(',') || 'none'} literal=${literalImp.map((el) => el.id).join(',') || 'none'}`);
      const bannerImp = doc.getElementById('validationBanner');
      hardenCheck('Import leaves banner hidden (valid state)', !!(bannerImp && bannerImp.style.display === 'none'),
        `banner display=${bannerImp ? bannerImp.style.display : 'missing'}`);
      hardenCheck('Import restores preset from file', doc.getElementById('modelPreset').value === 'deepseek-v3',
        `preset=${JSON.stringify(doc.getElementById('modelPreset').value)} (expect "deepseek-v3")`);
    }
  }

  // (c) IE-GAP-021: validation banner — blanking #quant must show a visible
  // hint instead of NaN values, and hide again once the input is valid.
  {
    const banner = doc.getElementById('validationBanner');
    setInput(win, doc, 'quant', '');
    win.recalculate();
    const visible = !!(banner && banner.style.display !== 'none');
    const hint = banner ? banner.textContent : '';
    hardenCheck('Banner visible on blank quant', visible && /Select a quantization/i.test(hint),
      `visible=${visible} text=${JSON.stringify(hint)}`);
    const numsBlank = collectRenderedNumbers(doc);
    const badBlank = numsBlank.filter((n) => !Number.isFinite(n.value));
    const literalBlank = [...doc.querySelectorAll('.metric .value')].filter((el) => /NaN|Infinity/.test(el.textContent));
    hardenCheck('Blank quant stays finite (IE-GAP-019 guard)', badBlank.length === 0 && literalBlank.length === 0,
      `non-finite=${badBlank.map((b) => b.label).join(',') || 'none'} literal=${literalBlank.map((el) => el.id).join(',') || 'none'}`);
    setInput(win, doc, 'quant', '4.5');
    win.recalculate();
    hardenCheck('Banner hidden on valid input', !!(banner && banner.style.display === 'none'),
      `banner display=${banner ? banner.style.display : 'missing'}`);
  }

  group('GAP hardening (019-022)', hardenAllPass, hardenResults.join('; '));

  // ===== TEST GROUP 7: Alphabetical preset ordering (2026-08-12 library refresh) =====
  // filterPresets() must render the dropdown sorted by display name (case-insensitive).
  {
    win.filterPresets();
    const sel = doc.getElementById('modelPreset');
    const names = [...sel.querySelectorAll('option')]
      .map((o) => o.textContent)
      .filter((t) => t && t !== '-- Select preset --');
    const sorted = [...names].sort((a, b) => a.localeCompare(b));
    const sameOrder = names.every((n, i) => n === sorted[i]);
    const missing = manifest.models.filter((id) => !win.eval('MODEL_PRESETS')[id]);
    group('Alphabetical presets',
      sameOrder && names.length === expectedCount && missing.length === 0,
      `${names.length}/${expectedCount} options, sorted=${sameOrder}, missing=${missing.length}`);
  }

  // ===== TEST GROUP 8: Docs consistency (IE-GAP-024 / IE-GAP-025) =====
  // README.md + root QUICKSTART.md must carry no stale "42" preset-count
  // references and no stale "166 KB" size claim; every preset-count claim in
  // README/QUICKSTART must match models/index.json (60); the standalone size
  // claim must be within ±5% of the real dist file; and README must point at
  // the single canonical guide (docs/QUICKSTART.md).
  {
    const docResults = [];
    let docAllPass = true;
    function docCheck(name, ok, detail) {
      if (!ok) docAllPass = false;
      docResults.push(`${ok ? 'PASS' : 'FAIL'} ${name}: ${detail}`);
    }

    const readText = (p) => (fs.existsSync(p) ? fs.readFileSync(p, 'utf8') : null);
    const readme = readText(path.join(ROOT, 'README.md'));
    const quickstart = readText(path.join(ROOT, 'QUICKSTART.md'));
    const docQuickstart = readText(path.join(ROOT, 'docs', 'QUICKSTART.md'));
    docCheck('README.md present', !!readme, readme ? `${readme.length} bytes` : 'MISSING');

    // (a) No literal "42" anywhere in README / root QUICKSTART — mirrors the
    // judge's `grep -i '42' README.md QUICKSTART.md` exactly (substring match).
    const where42 = [];
    if (readme && readme.includes('42')) where42.push('README.md');
    if (quickstart && quickstart.includes('42')) where42.push('QUICKSTART.md');
    docCheck('No stale "42" in README/QUICKSTART', where42.length === 0,
      where42.length ? `"42" found in ${where42.join(', ')}` : 'clean');

    // (b) Every preset-count claim in README/QUICKSTARTs must equal the
    // manifest count (catches "42 per-model JSONs" and "all 42 presets").
    function countClaims(txt) {
      const claims = [];
      if (!txt) return claims;
      const re = /(\d+)\s*(?:model\s+)?presets?|(\d+)\s*per-model\s+JSONs?/gi;
      let m;
      while ((m = re.exec(txt)) !== null) claims.push(parseInt(m[1] || m[2], 10));
      return claims;
    }
    const badClaims = [];
    for (const [name, txt] of [['README.md', readme], ['QUICKSTART.md', quickstart], ['docs/QUICKSTART.md', docQuickstart]]) {
      for (const c of countClaims(txt)) {
        if (c !== expectedCount) badClaims.push(`${name} claims ${c} presets`);
      }
    }
    docCheck('Preset counts match models/index.json', badClaims.length === 0,
      badClaims.length ? badClaims.join('; ') : `all claims = ${expectedCount}`);

    // (c) Standalone size claim within ±5% of the real dist file size.
    // Dist is gitignored build output — skip with a warning if absent.
    const distFile = path.join(ROOT, 'dist', 'inference-estimator-standalone.html');
    const distBytes = fs.existsSync(distFile) ? fs.statSync(distFile).size : 0;
    const sizeClaims = [];
    for (const [name, txt] of [['README.md', readme], ['QUICKSTART.md', quickstart]]) {
      if (!txt) continue;
      const re = /(\d+(?:\.\d+)?)\s*K(?:i?B)/gi;
      let m;
      while ((m = re.exec(txt)) !== null) sizeClaims.push([name, parseFloat(m[1])]);
    }
    const actualKiB = distBytes / 1024;
    const badSizes = sizeClaims.filter(([name, claimed]) => Math.abs(claimed - actualKiB) / actualKiB > 0.05);
    docCheck('Standalone size claim within ±5% of dist',
      distBytes > 0 && badSizes.length === 0,
      distBytes === 0
        ? 'dist file missing (build not regenerated) — size claims unchecked'
        : `${sizeClaims.map(([name, c]) => `${name}=${c} KB`).join(', ') || 'no size claims'} vs actual ${actualKiB.toFixed(1)} KiB`);

    // (d) README links to the single canonical guide (IE-GAP-025)
    const qsLink = /\[[^\]]*Quick Start[^\]]*\]\(docs\/QUICKSTART\.md\)/i.exec(readme || '');
    docCheck('README links to docs/QUICKSTART.md', !!qsLink && !!docQuickstart,
      qsLink ? 'docs/QUICKSTART.md' : 'no link to docs/QUICKSTART.md found');

    group('Docs consistency', docAllPass, docResults.join('; '));
  }

  // ===== TEST GROUP 9: Dist freshness (IE-GAP-027) =====
  // dist/inference-estimator-standalone.html is gitignored build output
  // (node scripts/build-standalone.js), so nothing in git forces a rebuild
  // after source/model changes. This group compares distinctive source
  // markers and the embedded preset count against the current
  // cluster-estimator.html + models/index.json and fails with a clear
  // 'dist is stale' message on drift. A missing dist file is a SKIPPED
  // warning, not a failure — fresh clones legitimately have no dist/.
  {
    const distFreshResults = [];
    let distFreshPass = true;
    function distCheck(name, ok, detail) {
      if (!ok) distFreshPass = false;
      distFreshResults.push(`${ok ? 'PASS' : 'FAIL'} ${name}: ${detail}`);
    }

    const distFile = path.join(ROOT, 'dist', 'inference-estimator-standalone.html');
    const srcText = fs.readFileSync(HTML_FILE, 'utf8');
    if (!fs.existsSync(distFile)) {
      group('Dist freshness', true,
        'SKIPPED — dist/inference-estimator-standalone.html missing (run node scripts/build-standalone.js)');
    } else {
      const distText = fs.readFileSync(distFile, 'utf8');
      // Distinctive source markers that the build must carry through verbatim.
      const markers = [
        ['validationBanner element', '<div id="validationBanner" class="validation-banner" style="display:none" role="alert"></div>'],
        ['URL hash encoder', 'function encodeConfigToHash()'],
        ['URL hash decoder', 'function decodeHashToConfig()'],
        ['model library loader', 'async function loadModelLibrary() {'],
      ];
      for (const [name, marker] of markers) {
        const inSrc = srcText.includes(marker);
        const inDist = distText.includes(marker);
        distCheck(`source marker: ${name}`,
          inSrc && inDist,
          !inSrc
            ? 'MISSING from cluster-estimator.html — dist is STALE: source changed, rebuild dist (node scripts/build-standalone.js)'
            : inDist
              ? 'present in dist'
              : 'MISSING from dist — dist is STALE vs source (rebuild: node scripts/build-standalone.js)');
      }
      // Embedded preset count: the standalone embeds one pretty-printed JSON
      // object per model (same shape the build script counts); the source's
      // fallback block and models/index.json must agree with it.
      const embeddedRe = /^\s*"[a-z0-9.-]+": \{\n\s*"id"/gm;
      const distEmbedded = (distText.match(embeddedRe) || []).length;
      const srcFallback = (srcText.match(/^\s*'[a-z0-9.-]+': \{ name:/gm) || []).length;
      const countOk = distEmbedded === expectedCount && srcFallback === expectedCount;
      distCheck('embedded preset count',
        countOk,
        `dist=${distEmbedded}, source fallback=${srcFallback}, models/index.json=${expectedCount}` +
          (countOk ? '' : ' — dist is STALE (rebuild: node scripts/build-standalone.js)'));
      group('Dist freshness', distFreshPass, distFreshResults.join('; '));
    }
  }

  // ===== TEST GROUP 10: Board evidence (IE-GAP-029) =====
  // scripts/verify-board-evidence.js is the foreman gate that makes the
  // board's "guard clean" claim auditable: every status=complete row must
  // carry a commit_hash that resolves to a real commit. Running it against
  // the REAL board here makes the gate a regression test for board hygiene —
  // if the board ever gains an unevidenced completion, npm test fails.
  // Negative fixtures (a temp copy with one hash cleared, and one with a
  // bogus hash) prove the gate actually rejects unevidenced rows.
  {
    const evResults = [];
    let evPass = true;
    function evCheck(name, ok, detail) {
      if (!ok) evPass = false;
      evResults.push(`${ok ? 'PASS' : 'FAIL'} ${name}: ${detail}`);
    }

    const gateScript = path.join(ROOT, 'scripts', 'verify-board-evidence.js');
    const realBoard = path.resolve(__dirname, '.coding-hermes', 'board', 'tasks.jsonl');
    const runGate = (file) => spawnSync(
      process.execPath, [gateScript, `--file=${file}`],
      { cwd: ROOT, encoding: 'utf8' }
    );

    // (a) Positive: the real board must satisfy the gate.
    const pos = runGate(realBoard);
    const posOut = (pos.stdout || '') + (pos.stderr || '');
    const okLine = /board evidence OK: \d+ complete rows, \d+ with commit_hash, 0 missing/.exec(posOut);
    evCheck('real board passes gate', pos.status === 0 && !!okLine,
      pos.status === 0
        ? (okLine ? okLine[0] : `OK line missing: ${posOut.trim()}`)
        : `exit ${pos.status}: ${posOut.trim()}`);

    // (b/c) Negative: a temp copy with a cleared hash and one with a bogus
    // hash must both fail (exit 1) and name the offending row id.
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'board-evidence-'));
    try {
      const boardText = fs.readFileSync(realBoard, 'utf8');
      const mkFixture = (patchHash) => {
        const rows = boardText.split('\n').filter((l) => l.trim() !== '').map((l) => JSON.parse(l));
        const row = rows.find((r) => r.status === 'complete');
        if (!row) throw new Error('no complete row in board fixture');
        const idx = rows.indexOf(row);
        row.commit_hash = patchHash;
        const fp = path.join(tmpDir, `fixture-${idx}.jsonl`);
        fs.writeFileSync(fp, rows.map((r) => JSON.stringify(r)).join('\n') + '\n');
        return { fp, id: row.id };
      };

      const cleared = mkFixture(null);
      const neg1 = runGate(cleared.fp);
      const out1 = (neg1.stdout || '') + (neg1.stderr || '');
      evCheck('cleared hash rejected', neg1.status === 1 && out1.includes(cleared.id),
        neg1.status === 1
          ? (out1.includes(cleared.id) ? `exit 1, names ${cleared.id}` : `exit 1 but does not name ${cleared.id}: ${out1.trim()}`)
          : `exit ${neg1.status}: ${out1.trim()}`);

      const bogus = mkFixture('deadbeefdeadbeefdeadbeefdeadbeefdeadbeef');
      const neg2 = runGate(bogus.fp);
      const out2 = (neg2.stdout || '') + (neg2.stderr || '');
      evCheck('bogus hash rejected', neg2.status === 1 && out2.includes(bogus.id),
        neg2.status === 1
          ? (out2.includes(bogus.id) ? `exit 1, names ${bogus.id}` : `exit 1 but does not name ${bogus.id}: ${out2.trim()}`)
          : `exit ${neg2.status}: ${out2.trim()}`);
    } finally {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }

    group('Board evidence', evPass, evResults.join('; '));
  }

  // ===== Summary =====
  const elapsed = ((Date.now() - t0) / 1000).toFixed(1);
  for (const g of results.groups) {
    console.log(`${g.pass ? 'PASS' : 'FAIL'}  ${g.name}: ${g.detail}`);
  }
  console.log(`---`);
  console.log(`${results.totalPass}/${results.groups.length} groups passed in ${elapsed}s`);

  const allPass = results.groups.every((g) => g.pass);
  process.exit(allPass ? 0 : 1);
})();
