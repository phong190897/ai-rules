// Managed by ai-rules. Do not edit; overwritten on sync.
'use strict';

// Counts tool calls in the current turn. Returns a one-line nudge at each multiple of the limit.
function tick(config, state) {
  if (!config.guards.turnBudget) return null;
  state.turn.toolCalls += 1;
  const n = config.turnNudgeAfterToolCalls;
  if (n > 0 && state.turn.toolCalls % n === 0) {
    return `ai-rules: ${state.turn.toolCalls} tool calls this turn. If the task is not converging, `
      + 'stop and give the user a short status; otherwise continue.';
  }
  return null;
}

module.exports = { tick };
