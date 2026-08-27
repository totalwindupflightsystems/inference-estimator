#!/usr/bin/env node
/**
 * Build script — regenerate dist/inference-estimator-standalone.html
 *
 * IE-GAP-007: the standalone distribution (166KB self-contained single file)
 * was hand-built with no committed generator. This script makes regeneration
 * reproducible:
 *
 *   1. Read cluster-estimator.html (source of truth)
 *   2. Read models/index.json (manifest → array of all model ids)
 *   3. Read each models/<id>.json and inline it into an EMBEDDED_MODEL_LIBRARY
 *      const, inserted right after the FALLBACK_MODEL_PRESETS block
 *   4. Replace the fetch-based loadModelLibrary() with the embedded-library
 *      iteration version (no network, works from file://)
 *   5. Write dist/inference-estimator-standalone.html
 *
 * Usage:
 *   node scripts/build-standalone.js
 *
 * Exit 0 only when the output contains all embedded models, zero fetch()
 * calls, and the standalone loader body.
 */

'use strict';

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const SRC_HTML = path.join(ROOT, 'cluster-estimator.html');
const INDEX_JSON = path.join(ROOT, 'models', 'index.json');
const MODELS_DIR = path.join(ROOT, 'models');
const OUT_HTML = path.join(ROOT, 'dist', 'inference-estimator-standalone.html');

// --- standalone loader body (replaces the fetch-based one) -----------------
// Keep in sync with the embedded loader used by the tool's offline mode.
const STANDALONE_LOADER = `async function loadModelLibrary() {
  // Standalone build: models are embedded inline — no network needed.
  const loaded = {};
  const loadedPricing = {};
  for (const [id, j] of Object.entries(EMBEDDED_MODEL_LIBRARY)) {
    loaded[id] = {
      name: j.name, params: j.params, arch: j.arch, activeParams: j.activeParams,
      nLayers: j.nLayers, nKvHeads: j.nKvHeads, headDim: j.headDim,
      hiddenSize: j.hiddenSize, desc: j.desc
    };
    if (j.pricing) {
      for (const [prov, p] of Object.entries(j.pricing)) {
        loadedPricing[prov] = loadedPricing[prov] || {};
        loadedPricing[prov][id] = p;
      }
    }
  }
  MODEL_PRESETS = loaded;
  API_PRICING = loadedPricing;
  refreshModelUI();
  flashStatus('Loaded ' + Object.keys(MODEL_PRESETS).length + ' models (embedded standalone) ✓');
}`;

// --- read inputs -----------------------------------------------------------
let html = fs.readFileSync(SRC_HTML, 'utf8');
const manifest = JSON.parse(fs.readFileSync(INDEX_JSON, 'utf8'));
const modelIds = manifest.models;
if (!Array.isArray(modelIds) || modelIds.length === 0) {
  console.error('models/index.json: expected { "models": [...] } with >= 1 id');
  process.exit(1);
}

// --- build EMBEDDED_MODEL_LIBRARY const ------------------------------------
// Format matches the hand-built standalone: one pretty-printed JSON object per
// model id, keyed by id, no extra indentation so the file stays diff-friendly.
const entries = modelIds.map((id) => {
  const fp = path.join(MODELS_DIR, `${id}.json`);
  if (!fs.existsSync(fp)) {
    console.error(`Missing model file: ${fp}`);
    process.exit(1);
  }
  const j = JSON.parse(fs.readFileSync(fp, 'utf8'));
  const body = JSON.stringify(j, null, 2).replace(/^/gm, '').replace(/\n/g, '\n');
  return `"${id}": ${body}`;
});

const embeddedConst = `const EMBEDDED_MODEL_LIBRARY = {\n${entries.join(',\n')}\n};`;

// --- splice 1: insert EMBEDDED_MODEL_LIBRARY after FALLBACK_MODEL_PRESETS ---
// Anchor: the closing of FALLBACK_MODEL_PRESETS is the FIRST occurrence of the
// Dynamic Model Library comment block; insert the const right before it.
const anchorComment = '// ===== Dynamic Model Library (CE-025) =====';
const anchorIdx = html.indexOf(anchorComment);
if (anchorIdx === -1) {
  console.error('Anchor comment "// ===== Dynamic Model Library (CE-025) =====" not found in cluster-estimator.html');
  process.exit(1);
}
// The const goes between the fallback block's closing "};" and the comment.
// Find the "};" that closes FALLBACK_MODEL_PRESETS (the line ending right
// before the anchor comment block).
const preAnchor = html.slice(0, anchorIdx);
const closeBraceIdx = preAnchor.lastIndexOf('};');
if (closeBraceIdx === -1) {
  console.error('Could not locate FALLBACK_MODEL_PRESETS closing "};"');
  process.exit(1);
}
const insertionPoint = closeBraceIdx + 2; // after "};"
html =
  html.slice(0, insertionPoint) +
  '\n\n' + embeddedConst + '\n\n' +
  html.slice(insertionPoint);

// --- splice 2: replace fetch-based loadModelLibrary ------------------------
// The fetch loader starts at "async function loadModelLibrary() {" and runs
// until the matching closing "}" before "function refreshModelUI()".
const loaderStartMarker = 'async function loadModelLibrary() {';
const loaderStart = html.indexOf(loaderStartMarker);
if (loaderStart === -1) {
  console.error('loadModelLibrary() not found in cluster-estimator.html');
  process.exit(1);
}
// Find the function's closing brace: scan for the NEXT top-level "function "
// declaration after the loader start. The loader is the last function before
// refreshModelUI(); its closing "}" is the one immediately before it.
const nextFnIdx = html.indexOf('\nfunction refreshModelUI()', loaderStart);
if (nextFnIdx === -1) {
  console.error('refreshModelUI() not found after loadModelLibrary()');
  process.exit(1);
}
// Walk backwards from nextFnIdx to find the closing "}" of loadModelLibrary.
let closeIdx = nextFnIdx - 1;
while (closeIdx > loaderStart && html[closeIdx] !== '}') closeIdx--;
if (closeIdx <= loaderStart) {
  console.error('Could not locate loadModelLibrary() closing brace');
  process.exit(1);
}
html =
  html.slice(0, loaderStart) +
  STANDALONE_LOADER +
  html.slice(closeIdx + 1);

// --- sanity checks ---------------------------------------------------------
const embeddedCount = (html.match(/^\s*"[a-z0-9.-]+": \{\n\s*"id"/gm) || []).length;
if (embeddedCount !== modelIds.length) {
  console.error(`Expected ${modelIds.length} embedded models, found ${embeddedCount}`);
  process.exit(1);
}
if (/fetch\s*\(/.test(html)) {
  console.error('Output still contains fetch() calls — standalone must be network-free');
  process.exit(1);
}
if (!html.includes('(embedded standalone)')) {
  console.error('Standalone loader body not found in output');
  process.exit(1);
}

// --- write ----------------------------------------------------------------
fs.mkdirSync(path.dirname(OUT_HTML), { recursive: true });
fs.writeFileSync(OUT_HTML, html);
console.log(`OK: ${OUT_HTML}`);
console.log(`    ${modelIds.length} models embedded, 0 fetch() calls, ${fs.statSync(OUT_HTML).size} bytes`);
