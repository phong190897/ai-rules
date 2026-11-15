// Managed by ai-rules. Do not edit; overwritten on sync.
'use strict';
const path = require('node:path');
const { splitCommands } = require('../lib/commands.cjs');

const ENV_FILE = /^\.env(\.[^/\\]+)?$/;
const ENV_SAFE = /\.(example|sample|template)$/;
const LEADING = new Set(['sudo', 'time', 'command', 'env', 'then', 'do', 'else', 'elif', '{', '!', 'exec', 'nohup', 'nice']);
const SHELLS = new Set(['bash', 'sh', 'zsh', 'dash', 'powershell', 'pwsh']);
const INSTALL_VALUE_FLAGS = new Set(['--prefix', '-w', '--workspace', '--registry', '--cwd', '--filter', '-F', '-C', '--dir']);
const base = (p) => String(p).split(/[\\/]/).pop();
const shortFlagHas = (arg, letter) => /^-[A-Za-z]+$/.test(arg) && arg.includes(letter);
const positionals = (args) => args.filter((a) => !a.startsWith('-'));

// Removes wrappers in front of a command (sudo, then, {, env VAR=x, .exe suffix).
function strip(tokens) {
  const t = tokens.slice();
  while (t.length && (LEADING.has(t[0]) || (t[0].startsWith('-') && LEADING.has(tokens[0])) || /^[A-Za-z_][A-Za-z0-9_]*=/.test(t[0]))) t.shift();
  if (t.length) t[0] = base(t[0]).replace(/\.exe$/i, '');
  return t;
}

// Every command in the line, including the ones inside `bash -c "..."` and `pwsh -Command "..."`, in order.
function expand(command, depth = 0) {
  const out = [];
  for (const raw of splitCommands(command)) {
    const t = strip(raw);
    if (!t.length) continue;
    const flag = SHELLS.has(t[0].toLowerCase()) ? t.findIndex((a) => /^-(c|command)$/i.test(a)) : -1;
    if (flag !== -1 && t[flag + 1] && depth < 3) out.push(...expand(t[flag + 1], depth + 1));
    else out.push(t);
  }
  return out;
}

function gitParts(tokens) {
  let i = 1;
  let dir = null;
  while (i < tokens.length && tokens[i].startsWith('-')) {
    if (tokens[i] === '-C') dir = tokens[i + 1] || null;
    i += tokens[i] === '-C' || tokens[i] === '-c' ? 2 : 1;
  }
  return { verb: tokens[i], args: tokens.slice(i + 1), dir };
}

function checkGit(tokens, config, ctx) {
  const { verb, args, dir } = gitParts(tokens);
  if (verb === 'commit' || verb === 'push') {
    if (ctx.branch) ctx = { currentBranch: ctx.branch, hasCommits: true };
    else if (ctx.forDir) ctx = ctx.forDir(path.resolve(ctx.cwd || process.cwd(), dir || '.'));
  }
  const main = config.mainBranch;
  const deny = (rule) => ({ decision: 'deny', reason: `ai-rules: ${rule}` });
  if (verb === 'push') {
    const forced = args.some((a) => a === '--force' || a.startsWith('--force-with-lease') || shortFlagHas(a, 'f')
      || (!a.startsWith('-') && a.startsWith('+')));
    if (forced) return deny('force-push is not allowed. Ask the user if a force-push is really needed.');
    if (args.includes('--no-verify')) return deny('`--no-verify` is not allowed. Fix the failing hook instead.');
    const refspecs = positionals(args).slice(1);
    const toMain = positionals(args).some((a) => a === main || a.replace(/^\+/, '').endsWith(`:${main}`));
    const tagsOnly = args.includes('--tags') && !refspecs.length;
    const fromMain = ctx.currentBranch === main && !tagsOnly
      && (refspecs.length === 0 || refspecs.some((a) => a === 'HEAD' || a === '@'));
    if (toMain || fromMain) {
      return deny(`pushing to the main branch (${main}) is not allowed. Push a feature branch and open a pull request.`);
    }
  } else if (verb === 'commit') {
    if (args.includes('--no-verify') || args.some((a) => /^-[A-Za-z]+$/.test(a) && a.includes('n'))) {
      return deny('`--no-verify` is not allowed. Fix the failing hook instead.');
    }
    if (ctx.currentBranch === main && ctx.hasCommits) {
      return deny(`committing on the main branch (${main}) is not allowed. Create a feature branch first.`);
    }
  } else if (verb === 'reset') {
    if (args.includes('--hard')) return deny('`git reset --hard` discards work. Ask the user first.');
  } else if (verb === 'clean') {
    const dry = args.includes('--dry-run') || args.some((a) => shortFlagHas(a, 'n'));
    if (!dry && args.some((a) => a === '--force' || shortFlagHas(a, 'f'))) {
      return deny('`git clean -f` deletes untracked files. Ask the user first.');
    }
  } else if (verb === 'add') {
    const bad = positionals(args).find((a) => ENV_FILE.test(base(a)) && !ENV_SAFE.test(base(a)));
    if (bad) return deny(`do not stage ${bad}; env files hold secrets.`);
  }
  return null;
}

// The branch a `git switch` / `git checkout` moves to (or creates), or null when the command does not change branch.
function branchAfter(tokens) {
  const { verb, args } = gitParts(tokens);
  if (verb !== 'switch' && verb !== 'checkout') return null;
  if (args.includes('--')) return null;
  const create = args.findIndex((a) => ['-c', '-C', '-b', '-B', '--create', '--force-create'].includes(a));
  if (create !== -1) return args[create + 1] || null;
  return positionals(args)[0] || null;
}

// Arguments that are not flags, skipping the value of flags such as --prefix.
function installArgs(rest) {
  const out = [];
  for (let i = 0; i < rest.length; i++) {
    if (INSTALL_VALUE_FLAGS.has(rest[i])) i++;
    else if (!rest[i].startsWith('-')) out.push(rest[i]);
  }
  return out;
}

function checkInstall(tokens) {
  let t = tokens;
  if (/^python[0-9.]*$/.test(t[0]) && t[1] === '-m') t = t.slice(2);
  const tool = t[0];
  const verb = t[1];
  const pos = installArgs(t.slice(2));
  const ask = (pkgs) => ({
    decision: 'ask',
    reason: `ai-rules: \`${t.join(' ')}\` adds a dependency (${pkgs.join(', ')}). Ask the user before adding dependencies.`,
  });
  if (tool === 'npm' && ['install', 'i', 'add'].includes(verb) && pos.length) return ask(pos);
  if (tool === 'pnpm' && (verb === 'add' || ['install', 'i'].includes(verb)) && pos.length) return ask(pos);
  if (tool === 'bun' && (verb === 'add' || ['install', 'i'].includes(verb)) && pos.length) return ask(pos);
  if (tool === 'yarn' && verb === 'add' && pos.length) return ask(pos);
  if (/^pip[0-9.]*$/.test(tool) && verb === 'install') {
    if (t.slice(2).some((a) => ['-r', '-e', '--requirement', '--editable'].includes(a))) return null;
    const pkgs = pos.filter((a) => a !== '.');
    return pkgs.length ? ask(pkgs) : null;
  }
  if (tool === 'uv' && verb === 'pip' && t[2] === 'install') {
    if (t.slice(3).some((a) => ['-r', '-e', '--requirement', '--editable'].includes(a))) return null;
    const pkgs = installArgs(t.slice(3)).filter((a) => a !== '.');
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
// ctx is { currentBranch, hasCommits }, or { cwd, forDir(dir) -> { currentBranch, hasCommits } } so that `cd X &&`
// and `git -C X` are looked at in the directory they really run in.
function checkDanger(command, config, ctx) {
  let ask = null;
  const state = { ...(ctx || {}) };
  for (const tokens of expand(command)) {
    if (tokens[0] === 'cd') {
      const target = tokens.slice(1).find((a) => !a.startsWith('-') && a.toLowerCase() !== '/d');
      if (target && state.forDir) state.cwd = path.resolve(state.cwd || process.cwd(), target);
      continue;
    }
    if (config.guards.danger && tokens[0] === 'git') {
      const r = checkGit(tokens, config, state);
      if (r) return r;
      // A branch change earlier on the same line decides what a later commit or push runs on.
      const moved = branchAfter(tokens);
      if (moved) state.branch = moved;
    }
    if (config.guards.dependencies && !ask) ask = checkInstall(tokens);
  }
  return ask;
}

module.exports = { checkDanger };
