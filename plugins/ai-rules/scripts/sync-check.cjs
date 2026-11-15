'use strict';
// SessionStart hook of the plugin: reports an out-of-date ai-rules copy, or offers setup once per new repo.
const fs = require('node:fs');
const path = require('node:path');
const { runSafely, projectDir } = require('../payload/managed/ai-rules/scripts/lib/io.cjs');
const { computeSourceVersion, readManifest, readSeq } = require('./sync.cjs');
const { scanRepo, formatReport, wasOffered, markOffered, defaultDataDir } = require('./scan.cjs');

function offerSetup(dir) {
  const dataDir = defaultDataDir();
  const report = scanRepo(dir);
  if (!report.isGitRoot || wasOffered(dataDir, dir)) return;
  markOffered(dataDir, dir);
  const lines = formatReport(report).map((l) => `- ${l}`);
  process.stdout.write(['ai-rules: this repository is not set up with ai-rules. Quick scan:', ...lines,
    'Ask the user once, in their language, whether to set it up. If they agree, use the ai-rules:init-repo skill. '
    + 'If they decline, do not ask again.', ''].join('\n'));
}

runSafely((input) => {
  if (process.env.CLAUDE_CODE_REMOTE === 'true') return;
  const dir = projectDir(input);
  if (!fs.existsSync(path.join(dir, '.claude', 'ai-rules.json'))) {
    offerSetup(dir);
    return;
  }
  const root = process.env.CLAUDE_PLUGIN_ROOT || path.join(__dirname, '..');
  const payloadDir = path.join(root, 'payload');
  const latest = computeSourceVersion(payloadDir);
  const manifest = readManifest(dir);
  const current = manifest ? manifest.sourceVersion : '';
  if (current === latest) return;
  // A repo that is ahead of the installed plugin (synced from GitHub first) must not be told to "update" backwards.
  if ((manifest ? manifest.sourceSeq : 0) > readSeq(payloadDir)) return;
  process.stdout.write(`ai-rules: an update is available (${current || 'none'} -> ${latest}). `
    + 'Ask the user whether to sync now; if they agree, use the ai-rules:sync-repo skill.\n');
});
