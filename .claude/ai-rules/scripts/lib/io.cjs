// Managed by ai-rules. Do not edit; overwritten on sync.
'use strict';
const crypto = require('node:crypto');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

function parseInput(text) {
  try {
    const v = JSON.parse(text);
    return v && typeof v === 'object' && !Array.isArray(v) ? v : {};
  } catch {
    return {};
  }
}

function readInput() {
  try {
    return parseInput(fs.readFileSync(0, 'utf8'));
  } catch {
    return {};
  }
}

function projectDir(input) {
  return process.env.CLAUDE_PROJECT_DIR || (input && input.cwd) || process.cwd();
}

// Key for the per-session state file. Without a session id, each project gets its own key instead of sharing one.
function sessionKey(input, dir) {
  const id = input && input.session_id;
  if (typeof id === 'string' && id) return id;
  return `p${crypto.createHash('sha1').update(String(dir || '')).digest('hex').slice(0, 12)}`;
}

function preToolDecision(decision, reason) {
  return {
    hookSpecificOutput: {
      hookEventName: 'PreToolUse',
      permissionDecision: decision,
      permissionDecisionReason: reason,
    },
  };
}

function contextOutput(eventName, text) {
  return { hookSpecificOutput: { hookEventName: eventName, additionalContext: text } };
}

function commandFailed(input) {
  if (!input || typeof input !== 'object') return false;
  if (input.hook_event_name === 'PostToolUseFailure') return true;
  const r = input.tool_response;
  if (typeof r === 'string') return /^Exit code [1-9]/.test(r);
  if (r && typeof r === 'object') {
    for (const k of ['exitCode', 'exit_code', 'code']) {
      if (typeof r[k] === 'number' && r[k] !== 0) return true;
    }
    if (r.is_error === true || r.interrupted === true) return true;
  }
  return false;
}

function emit(obj) {
  process.stdout.write(JSON.stringify(obj));
}

function debugLog(input) {
  if (process.env.AI_RULES_DEBUG !== '1') return;
  try {
    const dir = path.join(os.tmpdir(), 'ai-rules');
    fs.mkdirSync(dir, { recursive: true });
    fs.appendFileSync(path.join(dir, 'debug.log'), JSON.stringify(input) + '\n');
  } catch { /* ignore */ }
}

// Reads stdin, runs fn; any failure is swallowed so a hook never blocks by accident.
function runSafely(fn) {
  try {
    const input = readInput();
    debugLog(input);
    fn(input);
  } catch { /* fail open */ }
  process.exitCode = 0;
}

module.exports = {
  parseInput, readInput, projectDir, sessionKey, preToolDecision, contextOutput, commandFailed, emit, runSafely,
};
