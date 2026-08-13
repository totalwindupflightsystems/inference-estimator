#!/usr/bin/env node
/**
 * Foreman board-evidence gate (IE-GAP-028).
 *
 * Reads the JSONL task board and enforces that any COMPLETE row carrying
 * worker evidence also carries a commit_hash — the audit trail that
 * distinguishes a real completion from a fake one.
 *
 * Failure rule (exit 1, offending row ids listed):
 *   row.status === "complete" AND
 *     (worker_status === "complete" OR dispatched_at non-null OR
 *      worker_summary non-empty OR completed_at non-null)
 *   BUT commit_hash is null / empty / whitespace.
 *
 * Legacy rows (status complete, worker_status pending/null AND dispatched_at
 * null AND no summary/completed_at) are informational only — counted and
 * printed, never a failure (40+ such rows exist).
 *
 * Usage:
 *   node scripts/verify-board-evidence.js                 # repo-root default
 *   BOARD_JSONL=/path/to/tasks.jsonl node scripts/...     # env override
 *   node scripts/verify-board-evidence.js --file=/path    # flag override
 *   node scripts/verify-board-evidence.js /path           # positional override
 *
 * Zero dependencies — plain Node only.
 */
'use strict';

const fs = require('fs');
const path = require('path');

function resolveBoardPath() {
  // Explicit overrides first (used by tests / foreman audits against copies).
  if (process.env.BOARD_JSONL) return path.resolve(process.env.BOARD_JSONL);
  const flag = process.argv.find((a) => a.startsWith('--file='));
  if (flag) return path.resolve(flag.slice('--file='.length));
  const positional = process.argv.slice(2).find((a) => !a.startsWith('-'));
  if (positional) return path.resolve(positional);

  // Default: repo root (scripts/ is one level down); fall back to cwd-relative
  // so it also works when invoked from the repo root by another name.
  const viaScriptsDir = path.resolve(__dirname, '..', '.coding-hermes', 'board', 'tasks.jsonl');
  if (fs.existsSync(viaScriptsDir)) return viaScriptsDir;
  return path.resolve(process.cwd(), '.coding-hermes', 'board', 'tasks.jsonl');
}

const boardPath = resolveBoardPath();
let rows;
try {
  const text = fs.readFileSync(boardPath, 'utf8');
  rows = text
    .split('\n')
    .filter((l) => l.trim() !== '')
    .map((line, i) => {
      try {
        return JSON.parse(line);
      } catch (e) {
        throw new Error(`line ${i + 1} is not valid JSON: ${e.message}`);
      }
    });
} catch (e) {
  console.error(`board evidence gate: cannot read ${boardPath}: ${e.message}`);
  process.exit(2);
}

const hasText = (v) => typeof v === 'string' && v.trim() !== '';
const nonNull = (v) => v !== null && v !== undefined;

const offenders = new Set();
let complete = 0;
let withHash = 0;
let legacy = 0;

for (const row of rows) {
  if (row.status !== 'complete') continue;
  complete++;

  const hash = hasText(row.commit_hash);
  if (hash) withHash++;

  const claimsWork =
    row.worker_status === 'complete' ||
    nonNull(row.dispatched_at) ||
    hasText(row.worker_summary) ||
    nonNull(row.completed_at);

  if (claimsWork) {
    if (!hash) offenders.add(row.id);
  } else {
    legacy++;
  }
}

if (offenders.size > 0) {
  const ids = [...offenders].sort();
  console.error(
    `board evidence gate FAIL: ${ids.length} complete row(s) carry worker evidence but no commit_hash:`
  );
  for (const id of ids) console.error(`  - ${id}`);
  console.error(`legacy rows without evidence: ${legacy}`);
  process.exit(1);
}

console.log(
  `board evidence OK: ${complete} complete rows, ${withHash} with commit_hash, ${legacy} legacy`
);
process.exit(0);
