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

function deepMerge(base, over) {
  const out = JSON.parse(JSON.stringify(base));
  if (!isObj(over)) return out;
  for (const [k, v] of Object.entries(over)) {
    out[k] = isObj(v) && isObj(out[k]) ? deepMerge(out[k], v) : v;
  }
  return out;
}

function mergeConfig(raw) {
  return deepMerge(DEFAULTS, raw);
}

function loadConfig(projectDir) {
  try {
    const text = fs.readFileSync(path.join(projectDir, '.claude', 'ai-rules.json'), 'utf8');
    return mergeConfig(JSON.parse(text));
  } catch {
    return mergeConfig(null);
  }
}

module.exports = { DEFAULTS, mergeConfig, loadConfig };
