// README: the rule table is current, and the examples show real output.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { redact, restore, rules } from '../src/index.js';
import { buildTable, renderReadme, DESCRIPTIONS } from '../scripts/rules-table.mjs';

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const readme = readFileSync(join(root, 'README.md'), 'utf8');

function blockAfter(marker, lang = 'text') {
  const at = readme.indexOf(marker);
  assert.ok(at !== -1, 'README has no "' + marker + '"');
  const open = '```' + lang + '\n';
  const start = readme.indexOf(open, at) + open.length;
  return readme.slice(start, readme.indexOf('\n```', start));
}

test('README rule table matches the exported rules', () => {
  assert.equal(renderReadme(readme), readme, 'run npm run rules:readme');
  assert.equal(buildTable().split('\n').length, rules.length + 2);
  assert.deepEqual(Object.keys(DESCRIPTIONS).sort(), rules.map((r) => r.id).sort());
});

test('README rule count matches the engine', () => {
  const count = rules.filter((r) => r.id !== 'high-entropy').length;
  assert.match(readme, new RegExp('\\b' + count + ' rules for known credential formats'));
  assert.match(readme, new RegExp('There are ' + count + ' rules and an entropy check'));
});

test('README input and output example', () => {
  const input = blockAfter('Input:');
  assert.equal(redact(input).text, blockAfter('Output:'));
});

test('README restore example', () => {
  const input = blockAfter('Input:');
  const reply = blockAfter('With the input above and this reply:');
  const r = restore(reply, redact(input).entries);
  assert.equal(r.text, blockAfter('`restore()` returns'));
  assert.equal(r.total, 2);
  assert.equal(r.distinct, 2);
  assert.deepEqual(r.unknown, ['[GITHUB_TOKEN_1]']);
  assert.match(readme, /returns `total: 2`, `distinct: 2` and `unknown: \['\[GITHUB_TOKEN_1\]'\]`/);
});

test('README CLI example', () => {
  const input = blockAfter('Input:').split('\n').filter((l) => /^(OPENAI_API_KEY|DATABASE_URL)=/.test(l)).reverse().join('\n') + '\n';
  const dir = mkdtempSync(join(tmpdir(), 'secret-redactor-docs-'));
  try {
    writeFileSync(join(dir, 'app.log'), input);
    const bin = join(root, 'bin/secret-redactor.js');
    const check = spawnSync(process.execPath, [bin, '--check', 'app.log'], { cwd: dir, encoding: 'utf8' });
    const at = readme.indexOf('$ secret-redactor --check app.log\n');
    const shown = readme.slice(at, readme.indexOf('\n```', at)).split('\n');
    assert.equal(check.status, 1);
    assert.equal(check.stderr, shown.slice(1, 4).join('\n') + '\n');
    assert.deepEqual(shown.slice(4), ['$ echo $?', '1']);
    const json = spawnSync(process.execPath, [bin, '--json', 'app.log'], { cwd: dir, encoding: 'utf8' });
    assert.deepEqual(JSON.parse(json.stdout), JSON.parse(blockAfter('`secret-redactor --json app.log` writes', 'json')));
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('README links to the browser version once', () => {
  assert.equal(readme.split('zerotool.dev').length - 1, 1);
});
