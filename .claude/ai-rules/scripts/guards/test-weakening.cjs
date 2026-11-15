// Managed by ai-rules. Do not edit; overwritten on sync.
'use strict';

const MARKERS = [
  ['.skip(', /\.skip\(/],
  ['.only(', /\.only\(/],
  ['xit(', /\bxit\(/],
  ['xdescribe(', /\bxdescribe\(/],
  ['@ts-ignore', /@ts-ignore/],
  ['@ts-nocheck', /@ts-nocheck/],
  ['eslint-disable', /eslint-disable/],
  ['# type: ignore', /#\s*type:\s*ignore/],
  ['# noqa', /#\s*noqa/],
  ['@Ignore', /@Ignore\b/],
  ['@Disabled', /@Disabled\b/],
  ['t.Skip(', /\bt\.Skip\(/],
  ['pytest.mark.skip', /pytest\.mark\.skip/],
  ['#[ignore]', /#\[ignore\]/],
];

// Returns the markers that the edit adds (present in the new text, absent from the old).
function findWeakening(toolInput) {
  const input = toolInput || {};
  const next = String(input.new_string ?? input.content ?? input.new_source ?? '');
  const prev = String(input.old_string ?? '');
  return MARKERS.filter(([, re]) => re.test(next) && !re.test(prev)).map(([name]) => name);
}

module.exports = { findWeakening };
