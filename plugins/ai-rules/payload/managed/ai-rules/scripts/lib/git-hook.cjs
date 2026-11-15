// Managed by ai-rules. Do not edit; overwritten on sync.
'use strict';
const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');

const MARKER = '# ai-rules commit-msg';
const SHIM = [
  '#!/bin/sh',
  MARKER,
  'root="$(git rev-parse --show-toplevel 2>/dev/null)" || exit 0',
  'script="$root/.claude/ai-rules/scripts/git-commit-msg.cjs"',
  '[ -f "$script" ] || exit 0',
  'exec node "$script" "$1"',
  '',
].join('\n');

function git(dir, args) {
  return execFileSync('git', args, { cwd: dir, encoding: 'utf8', timeout: 3000, stdio: ['ignore', 'pipe', 'ignore'] }).trim();
}

// Copies the commit-msg shim into the repo's git hooks directory, never replacing someone else's hook.
function installCommitMsgHook(projectDir) {
  let hooksDir;
  try {
    hooksDir = git(projectDir, ['rev-parse', '--git-path', 'hooks']);
  } catch {
    return 'no-git';
  }
  try {
    if (git(projectDir, ['config', 'core.hooksPath'])) return 'skipped-hookspath';
  } catch { /* exit 1 means unset */ }
  const dir = path.resolve(projectDir, hooksDir);
  const file = path.join(dir, 'commit-msg');
  if (fs.existsSync(file)) {
    const current = fs.readFileSync(file, 'utf8');
    if (!current.includes(MARKER)) return 'skipped-foreign';
    if (current !== SHIM) fs.writeFileSync(file, SHIM, { mode: 0o755 });
    return 'present';
  }
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(file, SHIM);
  fs.chmodSync(file, 0o755);
  return 'installed';
}

module.exports = { SHIM, installCommitMsgHook };
