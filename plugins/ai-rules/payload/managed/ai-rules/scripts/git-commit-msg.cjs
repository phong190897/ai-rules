// Managed by ai-rules. Do not edit; overwritten on sync.
'use strict';
const fs = require('node:fs');
const { loadConfig } = require('./lib/config.cjs');
const { checkTitle } = require('./lib/conventions.cjs');

const EXEMPT = /^(Merge |Revert |fixup! |squash! |amend! )/;

// Returns null for a valid message, otherwise the reason.
function checkCommitMessage(message) {
  const lines = String(message || '').replace(/\r\n/g, '\n').split('\n');
  const subject = lines.find((l) => l.trim() !== '' && !l.startsWith('#'));
  if (subject === undefined) return 'commit message is empty.';
  if (EXEMPT.test(subject)) return null;
  const bad = checkTitle(subject);
  return bad ? `commit ${bad}` : null;
}

// By default only commits made by an AI session are checked; scope "all" checks every commit.
function shouldEnforce(env, config) {
  if (!config.guards.commitMsg) return false;
  if (config.commitMsg.scope === 'all') return true;
  return env.CLAUDECODE === '1' || env.CLAUDE_CODE_REMOTE === 'true' || env.AI_RULES_ENFORCE_COMMIT_MSG === '1';
}

if (require.main === module) {
  try {
    const config = loadConfig(process.cwd());
    if (shouldEnforce(process.env, config)) {
      const reason = checkCommitMessage(fs.readFileSync(process.argv[2], 'utf8'));
      if (reason) {
        process.stderr.write(`ai-rules: ${reason} Follow the ai-rules-writing-comments skill.\n`);
        process.exitCode = 1;
      }
    }
  } catch { /* never block a commit because of an internal error */ }
}

module.exports = { checkCommitMessage, shouldEnforce };
