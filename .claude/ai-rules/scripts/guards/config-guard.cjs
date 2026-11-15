// Managed by ai-rules. Do not edit; overwritten on sync.
'use strict';
const path = require('node:path');

// Forward slashes, Git Bash drive paths (/c/x -> c:/x), no trailing slash; "." and ".." are resolved later.
const norm = (p) => String(p).replace(/\\/g, '/').replace(/^\/([A-Za-z])\//, '$1:/').replace(/\/+$/, '');
const isAbs = (p) => p.startsWith('/') || /^[A-Za-z]:\//.test(p);
const EXACT = [
  '.claude/ai-rules.json',
  '.claude/settings.json',
  '.claude/settings.local.json',
  '.github/workflows/ai-rules-sync.yml',
  '.claude/rules/ai-rules-core.md',
];

// Asks the user before configuration or managed files are edited. Returns { decision: 'ask', reason } or null.
function checkConfigEdit(filePath, projectDir, manifestFiles) {
  const root = path.posix.normalize(norm(projectDir)).replace(/\/+$/, '');
  const file = norm(filePath);
  const abs = path.posix.normalize(isAbs(file) ? file : `${root}/${file}`);
  if (!abs.toLowerCase().startsWith(`${root.toLowerCase()}/`)) return null;
  const rel = abs.slice(root.length + 1);
  const lower = rel.toLowerCase();
  const managed = (manifestFiles || []).map((f) => norm(f).toLowerCase());
  const hit = EXACT.includes(lower)
    || lower.startsWith('.claude/ai-rules/')
    || /^\.claude\/skills\/ai-rules-[^/]+\//.test(lower)
    || managed.includes(lower);
  if (!hit) return null;
  return {
    decision: 'ask',
    reason: `ai-rules: ${rel} is managed configuration. Ask the user before changing it; managed files are overwritten on sync.`,
  };
}

module.exports = { checkConfigEdit };
