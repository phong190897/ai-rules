// Managed by ai-rules. Do not edit; overwritten on sync.
'use strict';

const TITLE_TYPES = ['feat', 'fix', 'refactor', 'docs', 'test', 'chore', 'perf', 'build', 'ci'];
const TITLE_MAX = 72;
const PR_SECTIONS = ['## Summary', '## Why', '## Changes', '## Testing'];
const TITLE_RE = new RegExp(`^(${TITLE_TYPES.join('|')})(\\([a-z0-9._/-]+\\))?!?: \\S.*$`);

// Returns null when the title is valid, otherwise the reason.
function checkTitle(title) {
  const t = String(title || '');
  if (!TITLE_RE.test(t)) {
    return `title "${t}" must look like "type(scope): summary" with type one of ${TITLE_TYPES.join(', ')}.`;
  }
  if (t.length > TITLE_MAX) return `title is ${t.length} characters; the limit is ${TITLE_MAX}.`;
  return null;
}

module.exports = { TITLE_TYPES, TITLE_MAX, PR_SECTIONS, checkTitle };
