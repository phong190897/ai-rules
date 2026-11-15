// Managed by ai-rules. Do not edit; overwritten on sync.
'use strict';

const SEPARATORS = new Set([';', '|', '&', '\n', '\r', '(', ')', '`']);
const ENV_ASSIGN = /^[A-Za-z_][A-Za-z0-9_]*=/;
const DEFAULT_E2E = ['playwright test', 'cypress run'];
const PACKAGE_MANAGERS = new Set(['npm', 'pnpm', 'yarn', 'bun']);
const WRAPPERS = new Set(['npx', 'pnpx', 'bunx', 'exec', 'dlx', 'npm', 'pnpm', 'yarn', 'bun', '--']);
const KINDS = ['e2e', 'test', 'build', 'lint'];

// Skips the body of a here-document that starts after index `from` (the newline). Returns the index to continue at.
function skipHeredocBody(s, from, heredoc) {
  let pos = from + 1;
  while (pos <= s.length) {
    let end = s.indexOf('\n', pos);
    if (end === -1) end = s.length;
    let line = s.slice(pos, end).replace(/\r$/, '');
    if (heredoc.strip) line = line.replace(/^\t+/, '');
    pos = end + 1;
    if (line === heredoc.word || end === s.length) break;
  }
  return pos - 1;
}

// Splits a shell command into sub-commands, each a list of tokens. Quote-aware: separators inside quotes do not
// split and quote characters are removed. Here-document bodies and "# ..." comments are not commands.
function splitCommands(command) {
  const cmds = [];
  let toks = [];
  let cur = '';
  let has = false;
  let q = null;
  let heredoc = null;
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
      // \" is an escaped quote, unless no quote follows: then it is a path such as "C:\repo\" that ends the string.
      else if (ch === '\\' && q === '"' && s[i + 1] === '"' && s.indexOf('"', i + 2) !== -1) { cur += '"'; i++; }
      else cur += ch;
    } else if (ch === '"' || ch === "'") {
      q = ch;
      has = true;
    } else if (ch === '#' && !has) {
      while (i + 1 < s.length && s[i + 1] !== '\n') i++;
    } else if (ch === '<' && s[i + 1] === '<' && s[i + 2] !== '<') {
      let j = i + 2;
      const strip = s[j] === '-';
      if (strip) j++;
      while (s[j] === ' ' || s[j] === '\t') j++;
      const quote = s[j] === '"' || s[j] === "'" ? s[j++] : null;
      let word = '';
      while (j < s.length && /[A-Za-z0-9_]/.test(s[j])) word += s[j++];
      if (quote && s[j] === quote) j++;
      if (word) { heredoc = { word, strip }; i = j - 1; } else { cur += ch; has = true; }
    } else if (ch === '\n' && heredoc) {
      pushCmd();
      i = skipHeredocBody(s, i, heredoc);
      heredoc = null;
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

// True when the pattern's words are the first words of the command (after an optional npx/exec-style wrapper).
// Whole words only, so "npm run build" does not match "npm run build:docs" and quoted text never matches.
function matches(tokens, pattern) {
  const pat = String(pattern || '').trim().split(/\s+/).filter(Boolean);
  if (!pat.length) return false;
  for (let i = 0; i <= Math.min(2, tokens.length - 1); i++) {
    if (i > 0 && !WRAPPERS.has(tokens[i - 1])) break;
    if (pat.every((p, k) => tokens[i + k] === p)) return true;
  }
  return false;
}

function isE2eScript(tokens) {
  if (!PACKAGE_MANAGERS.has(tokens[0])) return false;
  const name = tokens[1] === 'run' ? tokens[2] : tokens[1];
  return typeof name === 'string' && !name.startsWith('-') && name.includes('e2e');
}

function classifyCommand(command, config) {
  const subs = splitCommands(command);
  if (!subs.length) return null;
  const v = (config && config.verify) || {};
  const has = (pats) => subs.some((t) => (pats || []).some((p) => matches(t, p)));
  if (v.e2ePreflight && has([v.e2ePreflight])) return 'preflight';
  const cmds = v.commands || {};
  for (const kind of KINDS) {
    const pats = cmds[kind] || [];
    if (kind === 'e2e' && !pats.length) {
      if (has(DEFAULT_E2E) || subs.some(isE2eScript)) return 'e2e';
    } else if (has(pats)) {
      return kind;
    }
  }
  return null;
}

module.exports = { splitCommands, normalizeCommand, classifyCommand };
