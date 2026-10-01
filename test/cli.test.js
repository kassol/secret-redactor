// CLI: modes, options and exit codes. Runs bin/secret-redactor.js in a child process.
// Temporary files are written under os.tmpdir() and removed after the tests.

import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { chmodSync, mkdtempSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const BIN = join(root, 'bin/secret-redactor.js');
const tmp = mkdtempSync(join(tmpdir(), 'secret-redactor-test-'));
after(() => rmSync(tmp, { recursive: true, force: true }));

const OPENAI = 'sk-' + 'proj-' + 'Q9vXmT2kLp8RwZ4nYb7Hc1Js5Df3Ga6E' + 'u0KiWoPq';
const ENV = 'OPENAI_API_KEY=' + OPENAI + '\nMAX_TOKENS=1024\nDATABASE_URL=postgres://app:hunter2-staging@db:5432/app\n';
const ENV_REDACTED = 'OPENAI_API_KEY=[OPENAI_KEY_1]\nMAX_TOKENS=1024\nDATABASE_URL=postgres://app:[URL_PASSWORD_1]@db:5432/app\n';
const CLEAN = 'nothing to see here\nMAX_TOKENS=1024\n';

function cli(args, input) {
  const r = spawnSync(process.execPath, [BIN, ...args], { input: input ?? '', encoding: 'utf8', cwd: tmp });
  return { code: r.status, out: r.stdout, err: r.stderr };
}
let n = 0;
function file(content, name) {
  const p = join(tmp, name || 'f' + (++n) + '.txt');
  writeFileSync(p, content);
  return p;
}

test('stdin to stdout', () => {
  const r = cli([], ENV);
  assert.equal(r.code, 0);
  assert.equal(r.out, ENV_REDACTED);
  assert.equal(r.err, '');
});

test('file to stdout; the file is not changed', () => {
  const p = file(ENV);
  const r = cli([p]);
  assert.equal(r.code, 0);
  assert.equal(r.out, ENV_REDACTED);
  assert.equal(readFileSync(p, 'utf8'), ENV);
});

test('- reads stdin', () => {
  assert.equal(cli(['-'], ENV).out, ENV_REDACTED);
});

test('--in-place rewrites only files with findings and keeps the file mode', () => {
  const a = file(ENV);
  const b = file(CLEAN);
  chmodSync(a, 0o640);
  const mtimeB = statSync(b).mtimeMs;
  const r = cli(['--in-place', a, b]);
  assert.equal(r.code, 0, r.err);
  assert.equal(r.out, '');
  assert.equal(readFileSync(a, 'utf8'), ENV_REDACTED);
  assert.equal(statSync(a).mode & 0o777, 0o640);
  assert.equal(readFileSync(b, 'utf8'), CLEAN);
  assert.equal(statSync(b).mtimeMs, mtimeB);
  assert.match(r.err, /redacted 2 secrets/);
  assert.deepEqual(readdirSync(tmp).filter((f) => f.endsWith('.tmp')), [], 'no temporary file left');
});

test('-i keeps a UTF-8 BOM and CRLF line ends', () => {
  const p = file('\uFEFFpassword=hunter22\r\nok\r\n');
  assert.equal(cli(['-i', p]).code, 0);
  assert.equal(readFileSync(p, 'utf8'), '\uFEFFpassword=[SECRET_1]\r\nok\r\n');
});

test('--json lists findings with line and column and no secret values', () => {
  const p = file(ENV, 'app.env');
  const r = cli(['--json', p]);
  assert.equal(r.code, 0);
  const report = JSON.parse(r.out);
  assert.deepEqual(report, {
    files: [{
      path: p,
      findings: [
        { rule: 'openai-key', category: 'ai', placeholder: '[OPENAI_KEY_1]', line: 1, column: 16, start: 15, end: 15 + OPENAI.length },
        { rule: 'url-credential', category: 'password', placeholder: '[URL_PASSWORD_1]', line: 3, column: 29, start: ENV.indexOf('hunter2'), end: ENV.indexOf('hunter2') + 15 },
      ],
    }],
    skipped: [],
    errors: [],
  });
  assert.ok(!r.out.includes(OPENAI) && !r.out.includes('hunter2'));
});

test('--json on stdin uses path "-"', () => {
  const report = JSON.parse(cli(['--json'], 'token=abcd1234').out);
  assert.equal(report.files[0].path, '-');
  assert.equal(report.files[0].findings[0].placeholder, '[SECRET_1]');
});

test('--check: exit 1 with findings, listed on stderr without values', () => {
  const a = file(ENV, 'a.env');
  const b = file(CLEAN, 'b.txt');
  const r = cli(['--check', a, b]);
  assert.equal(r.code, 1);
  assert.equal(r.out, '');
  assert.match(r.err, /a\.env:1:16: openai-key \(ai\) -> \[OPENAI_KEY_1\]/);
  assert.match(r.err, /a\.env:3:29: url-credential \(password\) -> \[URL_PASSWORD_1\]/);
  assert.match(r.err, /2 secrets found in 1 input/);
  assert.ok(!r.err.includes(OPENAI) && !r.err.includes('hunter2'));
});

test('--check: exit 0 without findings', () => {
  const r = cli(['--check'], CLEAN);
  assert.equal(r.code, 0);
  assert.match(r.err, /no secrets found/);
});

test('--check --json: JSON on stdout, exit 1', () => {
  const r = cli(['--check', '--json'], ENV);
  assert.equal(r.code, 1);
  assert.equal(JSON.parse(r.out).files[0].findings.length, 2);
  assert.equal(r.err, '');
});

test('--disable and --only select categories', () => {
  assert.equal(cli(['--disable', 'password'], ENV).out, 'OPENAI_API_KEY=[OPENAI_KEY_1]\nMAX_TOKENS=1024\nDATABASE_URL=postgres://app:hunter2-staging@db:5432/app\n');
  assert.equal(cli(['--only=password,token'], ENV).out, 'OPENAI_API_KEY=[SECRET_1]\nMAX_TOKENS=1024\nDATABASE_URL=postgres://app:[URL_PASSWORD_1]@db:5432/app\n');
});

test('--placeholder template', () => {
  assert.equal(cli(['--placeholder', '<{label}>'], 'password=hunter22').out, 'password=<SECRET>');
});

test('--max-length: longer input exits 3 and writes no text', () => {
  const r = cli(['--max-length', '10'], ENV);
  assert.equal(r.code, 3);
  assert.equal(r.out, '');
  assert.match(r.err, /the limit is 10/);
  assert.equal(cli(['--max-length', 'Infinity'], ENV).code, 0);
});

test('binary and non-UTF-8 files are skipped with --check and are errors in single mode', () => {
  const bin = join(tmp, 'blob.bin');
  writeFileSync(bin, Buffer.from([0x70, 0x00, 0x71]));
  const latin1 = join(tmp, 'latin1.txt');
  writeFileSync(latin1, Buffer.from('caf\xe9 password=hunter22', 'latin1'));
  const r = cli(['--check', '--json', bin, latin1]);
  assert.equal(r.code, 0);
  assert.deepEqual(JSON.parse(r.out).skipped, [
    { path: bin, reason: 'binary file (contains NUL bytes)' },
    { path: latin1, reason: 'not valid UTF-8' },
  ]);
  const single = cli([latin1]);
  assert.equal(single.code, 3);
  assert.equal(single.out, '');
  assert.match(single.err, /not valid UTF-8/);
});

test('a missing file exits 3; code 3 has priority over code 1', () => {
  const a = file(ENV);
  const r = cli(['--check', a, join(tmp, 'missing.txt')]);
  assert.equal(r.code, 3);
  assert.match(r.err, /missing\.txt: cannot read \(ENOENT\)/);
  assert.match(r.err, /openai-key/);
});

test('usage errors exit 2', () => {
  const cases = [
    [['--nope']],
    [['--only', 'pii']],
    [['--only', 'ai', '--disable', 'cloud']],
    [['--in-place']],
    [['-i', '-']],
    [['-i', '--check', 'x']],
    [['a', 'b']],
    [['--max-length', '0']],
    [['--max-length']],
    [['--json=yes']],
    [['--placeholder', '[{name}]']],
  ];
  for (const [args] of cases) {
    const r = cli(args, ENV);
    assert.equal(r.code, 2, args.join(' ') + ': ' + r.err);
    assert.equal(r.out, '', args.join(' '));
  }
});

test('--help and --version', () => {
  const help = cli(['--help']);
  assert.equal(help.code, 0);
  assert.match(help.out, /Exit codes:/);
  const pkg = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'));
  assert.equal(cli(['--version']).out, pkg.version + '\n');
});

test('-- ends the options', () => {
  const p = file(ENV, '--weird-name.txt');
  assert.equal(cli(['--', '--weird-name.txt']).out, ENV_REDACTED);
  assert.ok(p);
});
