// Managed by ai-rules. Do not edit; overwritten on sync.
'use strict';
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const KINDS = ['e2e', 'test', 'build', 'lint'];

function newState() {
  return {
    turn: { toolCalls: 0, e2eFailed: 0 },
    failedWithoutChange: { e2e: 0, test: 0, build: 0, lint: 0 },
    lastFailed: { command: '', count: 0 },
    preflightPassed: false,
  };
}

const dir = () => process.env.AI_RULES_STATE_DIR || path.join(os.tmpdir(), 'ai-rules');
const fileFor = (id) => path.join(dir(), `${String(id || '').replace(/[^A-Za-z0-9_-]/g, '') || 'unknown'}.json`);

function loadState(sessionId) {
  const base = newState();
  try {
    const raw = JSON.parse(fs.readFileSync(fileFor(sessionId), 'utf8'));
    if (!raw || typeof raw !== 'object') return base;
    const num = (v) => (Number.isFinite(v) ? v : 0);
    base.turn.toolCalls = num(raw.turn && raw.turn.toolCalls);
    base.turn.e2eFailed = num(raw.turn && raw.turn.e2eFailed);
    for (const k of KINDS) base.failedWithoutChange[k] = num(raw.failedWithoutChange && raw.failedWithoutChange[k]);
    if (raw.lastFailed && typeof raw.lastFailed.command === 'string') {
      base.lastFailed = { command: raw.lastFailed.command, count: num(raw.lastFailed.count) };
    }
    base.preflightPassed = raw.preflightPassed === true;
    return base;
  } catch {
    return newState();
  }
}

function saveState(sessionId, state) {
  try {
    fs.mkdirSync(dir(), { recursive: true });
    const file = fileFor(sessionId);
    const tmp = `${file}.${process.pid}.tmp`;
    fs.writeFileSync(tmp, JSON.stringify(state));
    // On Windows the rename can fail while another hook is reading the file; retry before the non-atomic fallback.
    for (let attempt = 0; attempt < 4; attempt++) {
      try {
        fs.renameSync(tmp, file);
        return;
      } catch {
        const until = Date.now() + 10 * (attempt + 1);
        while (Date.now() < until) { /* brief wait */ }
      }
    }
    fs.writeFileSync(file, JSON.stringify(state));
    fs.rmSync(tmp, { force: true });
  } catch { /* state is best effort */ }
}

function resetTurn(state) {
  state.turn = { toolCalls: 0, e2eFailed: 0 };
  state.failedWithoutChange = { e2e: 0, test: 0, build: 0, lint: 0 };
  state.lastFailed = { command: '', count: 0 };
  return state;
}

function resetOnEdit(state) {
  state.failedWithoutChange = { e2e: 0, test: 0, build: 0, lint: 0 };
  state.lastFailed = { command: '', count: 0 };
  return state;
}

function cleanupOldStates(maxAgeDays = 7) {
  let n = 0;
  try {
    const cutoff = Date.now() - maxAgeDays * 86400000;
    for (const f of fs.readdirSync(dir())) {
      if (!f.endsWith('.json') && !f.endsWith('.tmp')) continue;
      const p = path.join(dir(), f);
      if (fs.statSync(p).mtimeMs < cutoff) { fs.rmSync(p, { force: true }); n++; }
    }
  } catch { /* ignore */ }
  return n;
}

module.exports = { newState, loadState, saveState, resetTurn, resetOnEdit, cleanupOldStates };
