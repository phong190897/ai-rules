// Managed by ai-rules. Do not edit; overwritten on sync.
'use strict';
const { normalizeCommand } = require('../lib/commands.cjs');

// Tracks the same non-verify command failing repeatedly. Returns a one-line nudge or null.
function recordOther(command, failed, config, state) {
  if (!config.guards.repeatNudge) return null;
  if (!failed) {
    state.lastFailed = { command: '', count: 0 };
    return null;
  }
  const cmd = normalizeCommand(command);
  if (cmd && cmd === state.lastFailed.command) state.lastFailed.count += 1;
  else state.lastFailed = { command: cmd, count: 1 };
  if (state.lastFailed.count === config.repeatNudgeAfter) {
    return `ai-rules: the same command has failed ${state.lastFailed.count} times with no changes in between. `
      + 'Stop repeating it; find the cause or report to the user.';
  }
  return null;
}

module.exports = { recordOther };
