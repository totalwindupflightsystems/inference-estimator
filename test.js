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
 * models/*.json from disk), waits for MODEL_PRESETS to populate (42 entries),
 * then exercises four test groups:
 *   1. Presets  — all 42 model presets produce finite rendered numbers
 *   2. Roundtrip — getConfig → JSON → setConfig → getConfig is lossless
 *   3. Edge     — 0 GPUs, 1B params, FP32 quant, 1M context → finite outputs
 *   4. GAP regressions — IE-GAP-011..014 (TP×PP floor, cloud fallback warning,
 *      poisoned-import finiteness, manifest PWA icons)
 *   5. Math known-answers — IE-GAP-016 (DeepSeek V3 worked example from
 *      QUICKSTART.md: modelMemGB ≈ 23.9, KV cache ≈ 42.4, GPUs Needed = 8,
 *      decode throughput ≈ 1523 — catches formula breakage like a dropped ×2)
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
const path = require('path');

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
async function loadPage() {
  const dom = await JSDOM.fromFile(HTML_FILE, {
    runScripts: 'dangerously',
    resources: 'usable',
    pretendToBeVisual: true,
    url: 'http://localhost/', // real origin so localStorage works (file:// = opaque)
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
  });
  return dom;
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
  const expectedCount = manifest.models.length; // 42

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
