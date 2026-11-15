// Managed by ai-rules. Do not edit; overwritten on sync.
'use strict';
const { runSafely, projectDir } = require('./lib/io.cjs');
const { loadConfig, configProblem } = require('./lib/config.cjs');
const { cleanupOldStates } = require('./lib/state.cjs');
const { installCommitMsgHook } = require('./lib/git-hook.cjs');

runSafely((input) => {
  const dir = projectDir(input);
  const config = loadConfig(dir);
  const lines = [];

  if (process.env.CLAUDE_CODE_REMOTE === 'true') {
    lines.push('ai-rules: this is a cloud session. Plugins (superpowers, catalog plugins) are not available here. '
      + "Do not try to install them; work with the repo's rules and ai-rules-* skills, "
      + 'and tell the user once if a task needs a plugin-only skill.');
  }

  const problem = configProblem(dir);
  if (problem) lines.push(problem);

  cleanupOldStates();

  if (config.guards.commitMsg) {
    const result = installCommitMsgHook(dir);
    if (result === 'skipped-hookspath' || result === 'skipped-foreign') {
      lines.push('ai-rules: commit message check is not installed because this repo already uses its own git hooks.');
    }
  }

  if (lines.length) process.stdout.write(`${lines.join('\n')}\n`);
});
