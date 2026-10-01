// Public API shape, options and package metadata.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { redact, restore, rules, categories, DEFAULT_MAX_LENGTH } from '../src/index.js';

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const B40 = 'Q9vXmT2kLp8RwZ4nYb7Hc1Js5Df3Ga6E' + 'u0KiWoPq';
const OPENAI = 'sk-' + 'proj-' + B40;
const SAMPLE = 'OPENAI_API_KEY=' + OPENAI + '\nDATABASE_URL=postgres://app:hunter2-staging@db:5432/app\nlog ' + OPENAI + '\n';

test('categories and rules are exported and frozen', () => {
  assert.deepEqual([...categories], ['ai', 'cloud', 'token', 'private-key', 'password', 'entropy']);
  assert.equal(rules.length, 31);
  assert.equal(rules[rules.length - 1].id, 'high-entropy');
  assert.equal(new Set(rules.map((r) => r.id)).size, rules.length, 'rule ids are unique');
  for (const r of rules) {
    assert.ok(categories.includes(r.category), r.id);
    assert.match(r.label, /^[A-Z][A-Z0-9_]*$/, r.id);
  }
  assert.ok(Object.isFrozen(rules) && Object.isFrozen(rules[0]) && Object.isFrozen(categories));
  assert.equal(DEFAULT_MAX_LENGTH, 1000000);
});

test('findings point at the replaced spans in the input', () => {
  const r = redact(SAMPLE);
  assert.equal(r.findings.length, 3);
  for (const f of r.findings) {
    const entry = r.entries.find((e) => e.placeholder === f.placeholder);
    assert.equal(SAMPLE.slice(f.start, f.end), entry.value);
  }
  assert.deepEqual(r.findings.map((f) => f.start), [...r.findings.map((f) => f.start)].sort((a, b) => a - b));
  assert.deepEqual(r.findings.map((f) => [f.rule, f.category, f.label, f.placeholder]), [
    ['openai-key', 'ai', 'OPENAI_KEY', '[OPENAI_KEY_1]'],
    ['url-credential', 'password', 'URL_PASSWORD', '[URL_PASSWORD_1]'],
    ['openai-key', 'ai', 'OPENAI_KEY', '[OPENAI_KEY_1]'],
  ]);
});

test('one value found by two rules shares the placeholder of the first rule', () => {
  const text = 'POSTGRES_PASSWORD: hunter2-staging\nDATABASE_URL: postgres://app:hunter2-staging@db:5432/app';
  const r = redact(text);
  assert.equal(r.entries.length, 1);
  assert.equal(r.entries[0].placeholder, '[SECRET_1]');
  assert.deepEqual(r.findings.map((f) => f.rule), ['keyed-secret', 'url-credential']);
  assert.deepEqual(r.findings.map((f) => f.placeholder), ['[SECRET_1]', '[SECRET_1]']);
});

test('categories option: unspecified categories stay on', () => {
  const r = redact(SAMPLE, { categories: { password: false } });
  assert.deepEqual(r.findings.map((f) => f.rule), ['openai-key', 'openai-key']);
  assert.ok(r.text.includes('hunter2-staging'));
});

test('categories option rejects unknown names and non-boolean values', () => {
  assert.throws(() => redact('x', { categories: { pii: false } }), /Unknown category "pii"/);
  assert.throws(() => redact('x', { categories: { ai: 0 } }), TypeError);
  assert.throws(() => redact('x', { categories: ['ai'] }), TypeError);
});

test('placeholder template', () => {
  const r = redact(SAMPLE, { placeholder: '<{category}:{label}#{n} {rule}>' });
  assert.equal(r.text, 'OPENAI_API_KEY=<ai:OPENAI_KEY#1 openai-key>\nDATABASE_URL=postgres://app:<password:URL_PASSWORD#1 url-credential>@db:5432/app\nlog <ai:OPENAI_KEY#1 openai-key>\n');
  assert.equal(r.entries[0].placeholder, '<ai:OPENAI_KEY#1 openai-key>');
  assert.equal(r.findings[2].placeholder, '<ai:OPENAI_KEY#1 openai-key>');
});

test('placeholder template without fields masks every value the same way', () => {
  assert.equal(redact('password=a1b2c3 token=z9y8x7').text, 'password=[SECRET_1] token=[SECRET_2]');
  assert.equal(redact('password=a1b2c3 token=z9y8x7', { placeholder: '***' }).text, 'password=*** token=***');
});

test('placeholder numbering follows the default format, also when it skips an existing literal', () => {
  const r = redact('see [SECRET_1]; password=hunter22', { placeholder: '{label}-{n}' });
  assert.equal(r.text, 'see [SECRET_1]; password=SECRET-2');
});

test('placeholder function', () => {
  const seen = [];
  const r = redact(SAMPLE, { placeholder: (info) => { seen.push(info); return '{{' + info.label.toLowerCase() + '_' + info.n + '}}'; } });
  assert.ok(r.text.startsWith('OPENAI_API_KEY={{openai_key_1}}'));
  assert.deepEqual(seen[0], { label: 'OPENAI_KEY', n: 1, rule: 'openai-key', category: 'ai' });
  assert.equal(seen.length, 2, 'called once per distinct value');
  assert.throws(() => redact(SAMPLE, { placeholder: () => 42 }), /must return a string/);
});

test('placeholder template rejects unknown fields', () => {
  assert.throws(() => redact('x', { placeholder: '[{name}]' }), /Unknown placeholder field \{name\}/);
  assert.throws(() => redact('x', { placeholder: 7 }), TypeError);
});

test('restore() refuses custom placeholders', () => {
  const r = redact(SAMPLE, { placeholder: '<{label}_{n}>' });
  assert.throws(() => restore(r.text, r.entries), /supports only the default format/);
});

test('restore() validates its arguments', () => {
  assert.throws(() => restore(1, []), TypeError);
  assert.throws(() => restore('x', {}), TypeError);
  assert.throws(() => restore('x', [{ placeholder: '[A_1]' }]), TypeError);
  assert.deepEqual(restore('x', []), { text: 'x', total: 0, distinct: 0, unknown: [] });
});

test('maxLength: default 1,000,000; longer input throws ERR_INPUT_TOO_LONG', () => {
  const big = 'a'.repeat(DEFAULT_MAX_LENGTH + 1);
  assert.throws(() => redact(big), (err) => err instanceof RangeError && err.code === 'ERR_INPUT_TOO_LONG');
  assert.equal(redact(big, { maxLength: Infinity }).text, big);
  assert.throws(() => redact('abcd', { maxLength: 3 }), { code: 'ERR_INPUT_TOO_LONG' });
  assert.throws(() => redact('x', { maxLength: -1 }), TypeError);
  assert.throws(() => redact('x', { maxLength: '10' }), TypeError);
});

test('redact() validates text and options', () => {
  assert.throws(() => redact(undefined), TypeError);
  assert.throws(() => redact(Buffer.from('x')), TypeError);
  assert.throws(() => redact('x', 'ai'), TypeError);
  assert.deepEqual(redact(''), { text: '', findings: [], entries: [] });
  assert.deepEqual(redact('x', null), { text: 'x', findings: [], entries: [] });
});

test('repeated calls give the same result (rule regex state is reset)', () => {
  const a = redact(SAMPLE);
  const b = redact(SAMPLE);
  assert.deepEqual(a, b);
});

test('library files import nothing, so they run in browsers', () => {
  for (const file of readdirSync(join(root, 'src')).filter((f) => f.endsWith('.js'))) {
    const src = readFileSync(join(root, 'src', file), 'utf8');
    const imports = [...src.matchAll(/^\s*import\s[^;]*?from\s+['"]([^'"]+)['"]/gm)].map((m) => m[1]);
    assert.ok(imports.every((s) => s.startsWith('./')), file + ' imports ' + imports.join(', '));
    assert.doesNotMatch(src, /\b(?:require\(|process\.|Buffer\b|globalThis\.process)/, file);
  }
});

test('package.json: no runtime dependencies; exports, bin, files and engines', () => {
  const pkg = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'));
  assert.equal(pkg.dependencies, undefined);
  assert.equal(pkg.type, 'module');
  assert.deepEqual(pkg.exports['.'], { types: './src/index.d.ts', default: './src/index.js' });
  assert.equal(pkg.bin['secret-redactor'], 'bin/secret-redactor.js');
  assert.deepEqual(pkg.files, ['src/', 'bin/']);
  assert.equal(pkg.engines.node, '>=18');
  assert.equal(pkg.license, 'MIT');
});
