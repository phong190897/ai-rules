// Managed by ai-rules. Do not edit; overwritten on sync.
'use strict';
const { splitCommands } = require('../lib/commands.cjs');
const { checkTitle, PR_SECTIONS } = require('../lib/conventions.cjs');

const SKIP_FLAGS = ['--fill', '--fill-first', '--fill-verbose', '--web', '--template', '-f', '-w', '-T'];

function flagValue(args, names) {
  for (let i = 0; i < args.length; i++) {
    for (const n of names) {
      if (args[i] === n) return args[i + 1];
      if (n.startsWith('--') && args[i].startsWith(`${n}=`)) return args[i].slice(n.length + 1);
    }
  }
  return undefined;
}

function missingSections(text) {
  // A heading starts a line, or directly follows the quote that opens an inline --body "...".
  return PR_SECTIONS.filter((s) => !new RegExp(`(?:^|["'])${s}[ \\t]*$`, 'm').test(text));
}

// Returns { decision: 'deny', reason } or null. readFile(path) returns text or null.
function checkPr(command, readFile) {
  const create = splitCommands(command).find((t) => t[0] === 'gh' && t[1] === 'pr' && t[2] === 'create');
  if (!create) return null;
  const args = create.slice(3);
  if (args.some((a) => SKIP_FLAGS.includes(a) || a.startsWith('--template='))) return null;

  const problems = [];
  const title = flagValue(args, ['--title', '-t']);
  if (title !== undefined) {
    const bad = checkTitle(title);
    if (bad) problems.push(`pull request ${bad}`);
  }

  let content = null;
  const bodyFile = flagValue(args, ['--body-file', '-F']);
  if (bodyFile !== undefined) {
    if (bodyFile !== '-') content = readFile(bodyFile);
  } else if (flagValue(args, ['--body', '-b']) !== undefined) {
    content = String(command);
  }
  if (content !== null && content !== undefined) {
    const missing = missingSections(content);
    if (missing.length) problems.push(`pull request body is missing: ${missing.join(', ')}.`);
  }

  if (!problems.length) return null;
  return { decision: 'deny', reason: `ai-rules: ${problems.join(' ')} Follow the ai-rules-creating-prs skill.` };
}

module.exports = { checkPr };
