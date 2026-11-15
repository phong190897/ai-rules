// Managed by ai-rules. Do not edit; overwritten on sync.
'use strict';
const { runSafely, projectDir, sessionKey, contextOutput, commandFailed, emit } = require('./lib/io.cjs');
const { loadConfig } = require('./lib/config.cjs');
const { loadState, saveState, resetOnEdit } = require('./lib/state.cjs');
const { recordResult } = require('./guards/verify.cjs');
const { recordOther } = require('./guards/repeat-nudge.cjs');
const { tick } = require('./guards/turn-budget.cjs');
const { findWeakening } = require('./guards/test-weakening.cjs');

const SHELLS = ['Bash', 'PowerShell'];
const EDITORS = ['Edit', 'Write', 'NotebookEdit'];

runSafely((input) => {
  const dir = projectDir(input);
  const config = loadConfig(dir);
  const key = sessionKey(input, dir);
  const state = loadState(key);
  const lines = [];
  const add = (line) => { if (line) lines.push(line); };

  add(tick(config, state));

  if (SHELLS.includes(input.tool_name)) {
    const command = String((input.tool_input || {}).command || '');
    const failed = commandFailed(input);
    if (command && !recordResult(command, failed, config, state)) {
      add(recordOther(command, failed, config, state));
    }
  } else if (EDITORS.includes(input.tool_name) && input.hook_event_name === 'PostToolUse') {
    resetOnEdit(state);
    if (config.guards.testWeakening) {
      const markers = findWeakening(input.tool_input);
      if (markers.length) {
        add(`ai-rules: this edit adds ${markers.join(', ')}. Do not disable tests or checks to get a pass; `
          + 'if it is intentional, say so in your report.');
      }
    }
  }

  saveState(key, state);
  if (lines.length) emit(contextOutput(input.hook_event_name || 'PostToolUse', lines.join('\n')));
});
