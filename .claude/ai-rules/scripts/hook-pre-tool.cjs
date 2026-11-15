// Managed by ai-rules. Do not edit; overwritten on sync.
'use strict';
const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const { runSafely, projectDir, sessionKey, preToolDecision, emit } = require('./lib/io.cjs');
const { loadConfig } = require('./lib/config.cjs');
const { loadState } = require('./lib/state.cjs');
const { checkDanger } = require('./guards/danger.cjs');
const { checkVerify } = require('./guards/verify.cjs');
const { checkPr } = require('./guards/pr-check.cjs');
const { checkConfigEdit } = require('./guards/config-guard.cjs');
const { findSecret } = require('./guards/secret.cjs');

const SHELLS = ['Bash', 'PowerShell'];
const EDITORS = ['Edit', 'Write', 'NotebookEdit'];

function git(dir, args) {
  return execFileSync('git', args, { cwd: dir, encoding: 'utf8', timeout: 3000, stdio: ['ignore', 'pipe', 'ignore'] }).trim();
}

function gitContext(dir) {
  let currentBranch = null;
  let hasCommits = true;
  try { currentBranch = git(dir, ['symbolic-ref', '--short', 'HEAD']); } catch { /* detached or not a repo */ }
  try { git(dir, ['rev-parse', '--verify', 'HEAD']); } catch { hasCommits = false; }
  if (currentBranch === null) hasCommits = true;
  return { currentBranch, hasCommits };
}

function manifestFiles(dir) {
  try {
    const m = JSON.parse(fs.readFileSync(path.join(dir, '.claude', 'ai-rules', 'manifest.json'), 'utf8'));
    return Array.isArray(m.files) ? m.files : [];
  } catch {
    return [];
  }
}

function shellDecisions(input, dir, config) {
  const command = String((input.tool_input || {}).command || '');
  if (!command) return [];
  const ctx = { cwd: input.cwd || dir, forDir: gitContext };
  const out = [checkDanger(command, config, ctx), checkVerify(command, config, loadState(sessionKey(input, dir)))];
  if (config.guards.prCheck) {
    const base = input.cwd || dir;
    out.push(checkPr(command, (p) => {
      try { return fs.readFileSync(path.resolve(base, p), 'utf8'); } catch { return null; }
    }));
  }
  return out;
}

function editDecisions(input, dir, config) {
  const ti = input.tool_input || {};
  const file = ti.file_path ?? ti.notebook_path;
  const text = ti.new_string ?? ti.content ?? ti.new_source;
  const out = [];
  if (config.guards.secrets && text) {
    const name = findSecret(text);
    if (name) {
      out.push({
        decision: 'deny',
        reason: `ai-rules: this content looks like a secret (${name}). Do not write secrets into the repository; use an environment variable.`,
      });
    }
  }
  if (config.guards.config && file) out.push(checkConfigEdit(file, dir, manifestFiles(dir)));
  return out;
}

runSafely((input) => {
  const dir = projectDir(input);
  const config = loadConfig(dir);
  let results = [];
  if (SHELLS.includes(input.tool_name)) results = shellDecisions(input, dir, config);
  else if (EDITORS.includes(input.tool_name)) results = editDecisions(input, dir, config);
  const found = results.filter(Boolean);
  const pick = found.find((r) => r.decision === 'deny') || found.find((r) => r.decision === 'ask');
  if (pick) emit(preToolDecision(pick.decision, pick.reason));
});
