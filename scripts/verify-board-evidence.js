#!/usr/bin/env node
/**
 * Foreman board-evidence gate (IE-GAP-028; hardened by IE-GAP-029).
 *
 * Reads the JSONL task board and enforces that EVERY row with
 * status === "complete" carries a non-empty commit_hash — the audit trail
 * that distinguishes a real completion from a fake one — and that each
 * hash actually resolves to a commit in the enclosing git repository.
 *
 * Failure rules (exit 1, offending row ids listed):
 *   1. row.status === "complete" AND commit_hash is null / empty /
 *      whitespace. There is no legacy blessing: a complete row without a
 *      commit_hash fails regardless of worker_status/dispatched_at/etc.
 *   2. When a git repository is detected (a .git entry found walking up
 *      from the working directory, or from the board file's directory),
 *      every hash in the row's commit_hash (comma-separated lists are
 *      supported) must resolve via `git cat-file -e <sha>^{commit}`.
 *      An unresolvable hash fails the row.
 *
 * Informational counters are printed on the OK line:
 *   board evidence OK: <N> complete rows, <M> with commit_hash, <K> missing
 *
 * Usage:
 *   node scripts/verify-board-evidence.js                 # repo-root default
 *   BOARD_JSONL=/path/to/tasks.jsonl node scripts/...     # env override
 *   node scripts/verify-board-evidence.js --file=/path    # flag override
 *   node scripts/verify-board-evidence.js /path           # positional override
 *
 * Zero dependencies — plain Node only (fs, path, child_process).
 */
'use strict';

const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

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

// Find the enclosing git repository by walking up from a start directory.
// Returns the repo root (dir containing .git) or null. .git may be a file
// (worktrees/submodules), so existence alone is the check.
function findGitRoot(start) {
  let dir = path.resolve(start);
  for (;;) {
    if (fs.existsSync(path.join(dir, '.git'))) return dir;
    const parent = path.dirname(dir);
    if (parent === dir) return null;
    dir = parent;
  }
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

// Git-repo detection: prefer the invocation cwd, fall back to the board
// file's directory (covers --file= pointing into a repo while cwd is not).
let gitRoot = findGitRoot(process.cwd());
if (!gitRoot) gitRoot = findGitRoot(path.dirname(boardPath));
let gitWarned = false;
function hashResolves(sha) {
  const r = spawnSync(
    'git', ['cat-file', '-e', `${sha}^{commit}`],
    { cwd: gitRoot, encoding: 'utf8', stdio: ['ignore', 'ignore', 'pipe'] }
  );
  if (r.error) {
    if (!gitWarned) {
      console.warn(
        `board evidence gate: git binary unavailable (${r.error.message}) — ` +
        `skipping hash-resolution checks`
      );
      gitWarned = true;
    }
    return true; // fail open: cannot verify, do not false-fail
  }
  return r.status === 0;
}

const hasText = (v) => typeof v === 'string' && v.trim() !== '';

const missingHash = new Set(); // complete rows without any commit_hash
const badHash = new Set(); // complete rows whose hash(es) do not resolve
let complete = 0;
let withHash = 0;

for (const row of rows) {
  if (row.status !== 'complete') continue;
  complete++;

  const hashes = hasText(row.commit_hash)
    ? row.commit_hash.split(',').map((h) => h.trim()).filter(Boolean)
    : [];
  if (hashes.length === 0) {
    missingHash.add(row.id);
    continue;
  }
  withHash++;

  if (gitRoot) {
    for (const h of hashes) {
      if (!hashResolves(h)) {
        badHash.add(row.id);
        break;
      }
    }
  }
}

const missing = complete - withHash;
const failed = missingHash.size > 0 || badHash.size > 0;

if (failed) {
  if (missingHash.size > 0) {
    console.error(
      `board evidence gate FAIL: ${missingHash.size} complete row(s) without commit_hash:`
    );
    for (const id of [...missingHash].sort()) console.error(`  - ${id}`);
  }
  if (badHash.size > 0) {
    console.error(
      `board evidence gate FAIL: ${badHash.size} complete row(s) with unresolvable commit_hash (git cat-file -e):`
    );
    for (const id of [...badHash].sort()) console.error(`  - ${id}`);
  }
  process.exit(1);
}

console.log(
  `board evidence OK: ${complete} complete rows, ${withHash} with commit_hash, ${missing} missing`
);
process.exit(0);
