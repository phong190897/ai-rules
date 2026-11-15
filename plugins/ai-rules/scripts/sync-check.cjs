'use strict';
// SessionStart hook of the plugin: tells the AI when this repo's ai-rules copy is out of date.
const fs = require('node:fs');
const path = require('node:path');
const { runSafely, projectDir } = require('../payload/managed/ai-rules/scripts/lib/io.cjs');
const { computeSourceVersion, readManifest } = require('./sync.cjs');

runSafely((input) => {
  if (process.env.CLAUDE_CODE_REMOTE === 'true') return;
  const dir = projectDir(input);
  if (!fs.existsSync(path.join(dir, '.claude', 'ai-rules.json'))) return;
  const root = process.env.CLAUDE_PLUGIN_ROOT || path.join(__dirname, '..');
  const latest = computeSourceVersion(path.join(root, 'payload'));
  const manifest = readManifest(dir);
  const current = manifest ? manifest.sourceVersion : '';
  if (current === latest) return;
  process.stdout.write(`ai-rules: an update is available (${current || 'none'} -> ${latest}). `
    + 'Ask the user whether to sync now; if they agree, use the ai-rules:sync-repo skill.\n');
});
