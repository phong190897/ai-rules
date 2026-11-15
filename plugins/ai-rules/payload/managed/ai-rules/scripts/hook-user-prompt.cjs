// Managed by ai-rules. Do not edit; overwritten on sync.
'use strict';
const { runSafely } = require('./lib/io.cjs');
const { loadState, saveState, resetTurn } = require('./lib/state.cjs');

// A new user message gives the AI a fresh budget for retries and tool calls.
runSafely((input) => {
  saveState(input.session_id, resetTurn(loadState(input.session_id)));
});
