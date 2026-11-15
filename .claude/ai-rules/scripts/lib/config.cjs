// Managed by ai-rules. Do not edit; overwritten on sync.
'use strict';
const fs = require('node:fs');
const path = require('node:path');

const DEFAULTS = {
  source: 'phong190897/ai-rules',
  mainBranch: 'main',
  guards: {
    verify: true, repeatNudge: true, turnBudget: true, testWeakening: true, prCheck: true,
    danger: true, dependencies: true, config: true, secrets: true, commitMsg: true,
  },
  verify: {
    commands: { e2e: [], test: [], build: [], lint: [] },
    e2ePreflight: null,
    maxFailedRunsWithoutChange: 2,
    maxE2eFailedRunsPerTurn: 4,
  },
  repeatNudgeAfter: 3,
  turnNudgeAfterToolCalls: 100,
  commitMsg: { scope: 'ai' },
};

const isObj = (v) => v && typeof v === 'object' && !Array.isArray(v);
const str = (v, def) => (typeof v === 'string' && v.trim() ? v : def);
const bool = (v, def) => (typeof v === 'boolean' ? v : def);
const int = (v, def, min) => (Number.isFinite(v) && v >= min ? Math.floor(v) : def);
const list = (v) => {
  if (typeof v === 'string') return v.trim() ? [v] : [];
  return Array.isArray(v) ? v.filter((x) => typeof x === 'string' && x.trim()) : [];
};

// Builds a complete config from untrusted JSON: every value of the wrong type falls back to its default,
// so a slip in the file can never switch a guard off by making the hook throw.
function mergeConfig(raw) {
  const r = isObj(raw) ? raw : {};
  const g = isObj(r.guards) ? r.guards : {};
  const v = isObj(r.verify) ? r.verify : {};
  const c = isObj(v.commands) ? v.commands : {};
  const d = DEFAULTS;
  return {
    source: str(r.source, d.source),
    mainBranch: str(r.mainBranch, d.mainBranch),
    guards: Object.fromEntries(Object.keys(d.guards).map((k) => [k, bool(g[k], d.guards[k])])),
    verify: {
      commands: { e2e: list(c.e2e), test: list(c.test), build: list(c.build), lint: list(c.lint) },
      e2ePreflight: str(v.e2ePreflight, null),
      maxFailedRunsWithoutChange: int(v.maxFailedRunsWithoutChange, d.verify.maxFailedRunsWithoutChange, 1),
      maxE2eFailedRunsPerTurn: int(v.maxE2eFailedRunsPerTurn, d.verify.maxE2eFailedRunsPerTurn, 1),
    },
    repeatNudgeAfter: int(r.repeatNudgeAfter, d.repeatNudgeAfter, 1),
    turnNudgeAfterToolCalls: int(r.turnNudgeAfterToolCalls, d.turnNudgeAfterToolCalls, 0),
    commitMsg: { scope: isObj(r.commitMsg) && r.commitMsg.scope === 'all' ? 'all' : 'ai' },
  };
}

const configFile = (projectDir) => path.join(projectDir, '.claude', 'ai-rules.json');
const readJson = (file) => JSON.parse(fs.readFileSync(file, 'utf8').replace(/^﻿/, ''));

function loadConfig(projectDir) {
  try {
    return mergeConfig(readJson(configFile(projectDir)));
  } catch {
    return mergeConfig(null);
  }
}

// A one-line message when .claude/ai-rules.json exists but cannot be used, otherwise null.
function configProblem(projectDir) {
  const file = configFile(projectDir);
  if (!fs.existsSync(file)) return null;
  try {
    if (isObj(readJson(file))) return null;
    return 'ai-rules: .claude/ai-rules.json must contain a JSON object; the defaults are in use. Ask the user to fix it.';
  } catch {
    return 'ai-rules: .claude/ai-rules.json is not valid JSON; the defaults are in use. Ask the user to fix it.';
  }
}

module.exports = { DEFAULTS, mergeConfig, loadConfig, configProblem };
