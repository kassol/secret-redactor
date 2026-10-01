// src/engine.js must equal the engine block of the ZeroTool browser tool.
// Skipped when the zerotool-dev checkout is not available (CI, other machines).
// Set ZEROTOOL_DEV_DIR to point at it.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { buildEngine, componentFile, sourceDir, ENGINE_PATH } from '../scripts/sync-engine.mjs';

const file = componentFile(sourceDir());
const skip = existsSync(file) ? false : 'zerotool-dev not found at ' + file + '; set ZEROTOOL_DEV_DIR';

test('src/engine.js matches the zerotool-dev engine block', { skip }, () => {
  assert.equal(readFileSync(ENGINE_PATH, 'utf8'), buildEngine(readFileSync(file, 'utf8')), 'run npm run sync');
});

test('buildEngine is stable and rejects a source without markers', () => {
  const component = [
    'x',
    '    /* ── engine:start ── */',
    '    var LIMIT = 1; var RULES = []; var ENTROPY_RULE = {}; var CATEGORY_IDS = []; var PH_EXACT = /x/;',
    '',
    '    function detect() {}',
    '    function restore() {}',
    '    /* ── engine:end ── */',
  ].join('\n');
  const out = buildEngine(component);
  assert.ok(out.includes('\nfunction detect() {}\n'));
  assert.ok(out.endsWith('export { LIMIT, RULES, ENTROPY_RULE, CATEGORY_IDS, PH_EXACT, detect, restore };\n'));
  assert.throws(() => buildEngine('no markers'), /markers not found/);
  assert.throws(() => buildEngine(component.replace('function restore', 'function restoreX')), /no longer declares: restore/);
});
