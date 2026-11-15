// Managed by ai-rules. Do not edit; overwritten on sync.
'use strict';

const SEPARATORS = new Set([';', '|', '&', '\n', '\r', '(', ')', '`']);
const ENV_ASSIGN = /^[A-Za-z_][A-Za-z0-9_]*=/;
const DEFAULT_E2E = ['playwright test', 'cypress run'];
const DEFAULT_E2E_RE = /\b(npm|pnpm|yarn|bun)\s+(run\s+)?\S*e2e\S*/;
const KINDS = ['e2e', 'test', 'build', 'lint'];

// Splits a shell command into sub-commands, each a list of tokens. Quote-aware:
// separators inside quotes do not split, and quote characters are removed.
function splitCommands(command) {
  const cmds = [];
  let toks = [];
  let cur = '';
  let has = false;
  let q = null;
  const pushTok = () => {
    if (has) toks.push(cur);
    cur = '';
    has = false;
  };
  const pushCmd = () => {
    pushTok();
    while (toks.length && ENV_ASSIGN.test(toks[0])) toks.shift();
    if (toks.length) cmds.push(toks);
    toks = [];
  };
  const s = String(command || '');
  for (let i = 0; i < s.length; i++) {
    const ch = s[i];
    if (q) {
      if (ch === q) q = null;
      else if (ch === '\\' && q === '"' && s[i + 1] === '"') { cur += '"'; i++; }
      else cur += ch;
    } else if (ch === '"' || ch === "'") {
      q = ch;
      has = true;
    } else if (SEPARATORS.has(ch)) {
      pushCmd();
    } else if (ch === ' ' || ch === '\t') {
      pushTok();
    } else {
      cur += ch;
      has = true;
    }
  }
  pushCmd();
  return cmds;
}

function normalizeCommand(command) {
  return String(command || '').trim().replace(/\s+/g, ' ');
}

function classifyCommand(command, config) {
  const subs = splitCommands(command).map((t) => t.join(' '));
  if (!subs.length) return null;
  const v = (config && config.verify) || {};
  const has = (pats) => subs.some((s) => (pats || []).some((p) => p && s.includes(p)));
  if (v.e2ePreflight && subs.some((s) => s.includes(v.e2ePreflight))) return 'preflight';
  const cmds = v.commands || {};
  for (const kind of KINDS) {
    const pats = cmds[kind] || [];
    if (kind === 'e2e' && !pats.length) {
      if (has(DEFAULT_E2E) || subs.some((s) => DEFAULT_E2E_RE.test(s))) return 'e2e';
    } else if (has(pats)) {
      return kind;
    }
  }
  return null;
}

module.exports = { splitCommands, normalizeCommand, classifyCommand };
