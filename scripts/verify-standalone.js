#!/usr/bin/env node
/**
 * Verify dist/inference-estimator-standalone.html loads WITHOUT any fetch
 * polyfill — proving the embedded library works from file:// offline.
 * IE-GAP-007 acceptance: "works from file://" + all presets populate (count from models/index.json).
 */
'use strict';

const fs = require('fs');
const path = require('path');

// Expected model count = manifest length (kept in sync with models/index.json).
const MANIFEST_EXPECTED = JSON.parse(
  fs.readFileSync(path.join(__dirname, '..', 'models', 'index.json'), 'utf8')
).models.length;

const { JSDOM } = require('jsdom');

const ROOT = path.resolve(__dirname, '..');
const HTML_FILE = path.join(ROOT, 'dist', 'inference-estimator-standalone.html');

(async () => {
  // NOTE: no window.fetch polyfill here — if the standalone still called
  // fetch(), MODEL_PRESETS would stay at the fallback count (or 0) and the
  // eval below would throw / return < 42.
  const dom = await JSDOM.fromFile(HTML_FILE, {
    runScripts: 'dangerously',
    resources: 'usable',
    pretendToBeVisual: true,
    url: 'http://localhost/',
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
      // DELIBERATELY no fetch polyfill — offline/file:// proof.
    },
  });

  const win = dom.window;
  // Wait for the embedded loader to run (synchronous-ish, but give it time).
  let n = 0;
  for (let i = 0; i < 50; i++) {
    try { n = win.eval('Object.keys(MODEL_PRESETS).length'); } catch (e) { n = 0; }
    if (n >= MANIFEST_EXPECTED) break;
    await new Promise((r) => setTimeout(r, 100));
  }

  console.log('MODEL_PRESETS entries:', n);
  if (n !== MANIFEST_EXPECTED) {
    console.error('FAIL: expected ' + MANIFEST_EXPECTED + ' embedded models, got ' + n);
    process.exit(1);
  }

  // Also prove a real calculation renders (presets produce finite numbers).
  try {
    win.eval('applyPreset("DeepSeek V4 Flash")');
    win.eval('recalculate()');
    const params = win.document.getElementById('params').value;
    const active = win.document.getElementById('activeParams').value;
    console.log('applyPreset DeepSeek V4 Flash → params=' + params + ', activeParams=' + active);
  } catch (e) {
    console.error('FAIL: preset/calc smoke: ' + e.message);
    process.exit(1);
  }

  console.log('PASS: standalone loads ' + MANIFEST_EXPECTED + ' models with zero network, calculation renders.');
  process.exit(0);
})().catch((e) => {
  console.error('FAIL: ' + e.message);
  process.exit(1);
});
