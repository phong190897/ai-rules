// Managed by ai-rules. Do not edit; overwritten on sync.
'use strict';
const { classifyCommand } = require('../lib/commands.cjs');

const KINDS = ['e2e', 'test', 'build', 'lint'];

// Pure check: returns { decision: 'deny', reason } or null. Never changes state.
function checkVerify(command, config, state) {
  if (!config.guards.verify) return null;
  const kind = classifyCommand(command, config);
  if (!KINDS.includes(kind)) return null;
  const v = config.verify;
  if (kind === 'e2e' && v.e2ePreflight && !state.preflightPassed) {
    return { decision: 'deny', reason: `ai-rules: run the environment preflight before e2e: \`${v.e2ePreflight}\`.` };
  }
  const streak = state.failedWithoutChange[kind];
  if (streak >= v.maxFailedRunsWithoutChange) {
    return {
      decision: 'deny',
      reason: `ai-rules: \`${kind}\` has failed ${streak} times in a row with no file changes. Stop re-running it. `
        + 'Classify the failure with the ai-rules-handling-failures skill (read .claude/known-issues.md first) '
        + 'and report to the user with evidence. The limit resets when the user sends a new message.',
    };
  }
  if (kind === 'e2e' && state.turn.e2eFailed >= v.maxE2eFailedRunsPerTurn) {
    return {
      decision: 'deny',
      reason: `ai-rules: e2e has failed ${state.turn.e2eFailed} times this turn. Stop and report to the user with `
        + 'evidence. The limit resets when the user sends a new message.',
    };
  }
  return null;
}

// Records a finished command. Returns true when it was a verify or preflight command.
function recordResult(command, failed, config, state) {
  const kind = classifyCommand(command, config);
  if (kind === 'preflight') {
    if (!failed) state.preflightPassed = true;
    return true;
  }
  if (!KINDS.includes(kind)) return false;
  if (failed) {
    state.failedWithoutChange[kind] += 1;
    if (kind === 'e2e') state.turn.e2eFailed += 1;
  } else {
    state.failedWithoutChange[kind] = 0;
  }
  return true;
}

module.exports = { checkVerify, recordResult };
