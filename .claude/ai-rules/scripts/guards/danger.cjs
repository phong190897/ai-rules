// Managed by ai-rules. Do not edit; overwritten on sync.
'use strict';
const { splitCommands } = require('../lib/commands.cjs');

const ENV_FILE = /^\.env(\.[^/\\]+)?$/;
const ENV_SAFE = /\.(example|sample|template)$/;
const base = (p) => String(p).split(/[\\/]/).pop();
const shortFlagHas = (arg, letter) => /^-[A-Za-z]+$/.test(arg) && arg.includes(letter);
const positionals = (args) => args.filter((a) => !a.startsWith('-'));

function gitParts(tokens) {
  let i = 1;
  while (i < tokens.length && tokens[i].startsWith('-')) i += tokens[i] === '-C' || tokens[i] === '-c' ? 2 : 1;
  return { verb: tokens[i], args: tokens.slice(i + 1) };
}

function checkGit(tokens, config, ctx) {
  const { verb, args } = gitParts(tokens);
  const main = config.mainBranch;
  const deny = (rule) => ({ decision: 'deny', reason: `ai-rules: ${rule}` });
  if (verb === 'push') {
    if (args.some((a) => a.startsWith('--force') || shortFlagHas(a, 'f') || (!a.startsWith('-') && a.startsWith('+')))) {
      return deny('force-push is not allowed. Ask the user if a force-push is really needed.');
    }
    if (args.includes('--no-verify')) return deny('`--no-verify` is not allowed. Fix the failing hook instead.');
    const pos = positionals(args);
    const toMain = pos.some((a) => a === main || a.replace(/^\+/, '').endsWith(`:${main}`));
    if (toMain || (pos.slice(1).length === 0 && ctx.currentBranch === main)) {
      return deny(`pushing to the main branch (${main}) is not allowed. Push a feature branch and open a pull request.`);
    }
  } else if (verb === 'commit') {
    if (args.includes('--no-verify') || args.includes('-n')) {
      return deny('`--no-verify` is not allowed. Fix the failing hook instead.');
    }
    if (ctx.currentBranch === main && ctx.hasCommits) {
      return deny(`committing on the main branch (${main}) is not allowed. Create a feature branch first.`);
    }
  } else if (verb === 'reset') {
    if (args.includes('--hard')) return deny('`git reset --hard` discards work. Ask the user first.');
  } else if (verb === 'clean') {
    if (args.some((a) => a === '--force' || shortFlagHas(a, 'f'))) {
      return deny('`git clean -f` deletes untracked files. Ask the user first.');
    }
  } else if (verb === 'add') {
    const bad = positionals(args).find((a) => ENV_FILE.test(base(a)) && !ENV_SAFE.test(base(a)));
    if (bad) return deny(`do not stage ${bad}; env files hold secrets.`);
  }
  return null;
}

function checkInstall(tokens) {
  let t = tokens;
  if (/^python[0-9.]*$/.test(t[0]) && t[1] === '-m') t = t.slice(2);
  const tool = t[0];
  const verb = t[1];
  const rest = t.slice(2);
  const pos = positionals(rest);
  const ask = (pkgs) => ({
    decision: 'ask',
    reason: `ai-rules: \`${t.join(' ')}\` adds a dependency (${pkgs.join(', ')}). Ask the user before adding dependencies.`,
  });
  if (tool === 'npm' && ['install', 'i', 'add'].includes(verb) && pos.length) return ask(pos);
  if (['pnpm', 'yarn', 'bun'].includes(tool) && verb === 'add' && pos.length) return ask(pos);
  if (/^pip[0-9.]*$/.test(tool) && verb === 'install') {
    if (rest.some((a) => ['-r', '-e', '--requirement', '--editable'].includes(a))) return null;
    const pkgs = pos.filter((a) => a !== '.');
    return pkgs.length ? ask(pkgs) : null;
  }
  if (['uv', 'poetry', 'cargo'].includes(tool) && verb === 'add' && pos.length) return ask(pos);
  if (tool === 'go' && verb === 'get') {
    const pkgs = pos.filter((a) => !a.startsWith('.'));
    return pkgs.length ? ask(pkgs) : null;
  }
  if (tool === 'dotnet' && verb === 'add' && t.includes('package')) {
    return ask([t[t.indexOf('package') + 1] || 'package']);
  }
  if (tool === 'composer' && verb === 'require' && pos.length) return ask(pos);
  if (tool === 'gem' && verb === 'install' && pos.length) return ask(pos);
  if (tool === 'bundle' && verb === 'add' && pos.length) return ask(pos);
  return null;
}

// Returns { decision: 'deny' | 'ask', reason } or null. Deny wins over ask.
function checkDanger(command, config, ctx) {
  let ask = null;
  for (const tokens of splitCommands(command)) {
    if (config.guards.danger && tokens[0] === 'git') {
      const r = checkGit(tokens, config, ctx || {});
      if (r) return r;
    }
    if (config.guards.dependencies && !ask) ask = checkInstall(tokens);
  }
  return ask;
}

module.exports = { checkDanger };
