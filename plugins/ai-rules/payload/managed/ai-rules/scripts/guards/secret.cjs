// Managed by ai-rules. Do not edit; overwritten on sync.
'use strict';

// Only high-confidence shapes, so random strings in tests are not flagged.
const PATTERNS = [
  ['private-key', /-----BEGIN (?:[A-Z]+ )?PRIVATE KEY-----/],
  ['aws-access-key', /\bAKIA[0-9A-Z]{16}\b/],
  ['github-token', /\bgh[pousr]_[A-Za-z0-9]{36,}\b|\bgithub_pat_[A-Za-z0-9_]{60,}\b/],
  ['stripe-live-key', /\b[sr]k_live_[A-Za-z0-9]{20,}\b/],
  ['slack-token', /\bxox[baprs]-[A-Za-z0-9-]{20,}\b/],
  ['anthropic-key', /\bsk-ant-[A-Za-z0-9_-]{40,}\b/],
  ['google-api-key', /\bAIza[0-9A-Za-z_-]{35}\b/],
];

// Returns the name of the first matching secret shape, or null.
function findSecret(text) {
  const t = String(text || '');
  for (const [name, re] of PATTERNS) if (re.test(t)) return name;
  return null;
}

module.exports = { findSecret };
