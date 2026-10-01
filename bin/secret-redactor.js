#!/usr/bin/env node
// secret-redactor CLI. Usage and exit codes: see HELP below and README.md.

import { chmodSync, readFileSync, realpathSync, renameSync, statSync, unlinkSync, writeFileSync } from 'node:fs';
import { basename, dirname, join } from 'node:path';
import { redact, categories, DEFAULT_MAX_LENGTH } from '../src/index.js';

const EXIT_OK = 0;
const EXIT_FOUND = 1;
const EXIT_USAGE = 2;
const EXIT_INPUT = 3;

const HELP = `Usage: secret-redactor [options] [file ...]

Replace API keys, tokens and passwords with placeholders such as [OPENAI_KEY_1].
With no file, or when file is -, read standard input.

Output modes (default: write the redacted text to standard output; one input only):
  -i, --in-place        Rewrite each file with the redacted text. Needs file arguments.
      --json            Write the findings as JSON to standard output. No secret values.
      --check           Write no text. List findings on standard error.
                        Exit with code 1 if there is a finding.

Detection:
      --only <list>     Use only these categories (comma-separated).
      --disable <list>  Turn off these categories (comma-separated).
                        Categories: ${categories.join(', ')}
      --placeholder <template>
                        Replacement format. Fields: {label} {n} {rule} {category}.
                        Default: [{label}_{n}]
      --max-length <n>  Maximum characters per input (default ${DEFAULT_MAX_LENGTH}).
                        Use "Infinity" for no limit.

  -h, --help            Show this help.
  -V, --version         Show the version.

Exit codes:
  0  Success. With --check: no findings.
  1  --check found at least one secret.
  2  Usage error. No input was read.
  3  An input could not be read, decoded or written, or is longer than --max-length.
     Code 3 has priority over code 1.
`;

class UsageError extends Error {}

function parseList(value, flag) {
  const list = value.split(',').map((s) => s.trim()).filter(Boolean);
  if (!list.length) throw new UsageError(flag + ' needs at least one category');
  for (const c of list) {
    if (!categories.includes(c)) throw new UsageError('unknown category "' + c + '". Categories: ' + categories.join(', '));
  }
  return list;
}

function parseArgs(argv) {
  const opts = { inPlace: false, json: false, check: false, only: null, disable: null, placeholder: undefined, maxLength: undefined, help: false, version: false, files: [] };
  const withValue = new Set(['--only', '--disable', '--placeholder', '--max-length']);
  for (let i = 0; i < argv.length; i++) {
    let arg = argv[i];
    if (arg === '--') { opts.files.push(...argv.slice(i + 1)); break; }
    if (arg === '-' || !arg.startsWith('-')) { opts.files.push(arg); continue; }
    let value;
    const eq = arg.indexOf('=');
    if (arg.startsWith('--') && eq !== -1) { value = arg.slice(eq + 1); arg = arg.slice(0, eq); }
    if (withValue.has(arg)) {
      if (value === undefined) {
        if (i + 1 >= argv.length) throw new UsageError(arg + ' needs a value');
        value = argv[++i];
      }
    } else if (value !== undefined) {
      throw new UsageError(arg + ' does not take a value');
    }
    switch (arg) {
      case '-i': case '--in-place': opts.inPlace = true; break;
      case '--json': opts.json = true; break;
      case '--check': opts.check = true; break;
      case '-h': case '--help': opts.help = true; break;
      case '-V': case '--version': opts.version = true; break;
      case '--only': opts.only = parseList(value, arg); break;
      case '--disable': opts.disable = parseList(value, arg); break;
      case '--placeholder': opts.placeholder = value; break;
      case '--max-length': {
        const n = value === 'Infinity' ? Infinity : Number(value);
        if (!(n === Infinity || (Number.isInteger(n) && n > 0))) throw new UsageError('--max-length must be a positive integer or Infinity');
        opts.maxLength = n;
        break;
      }
      default: throw new UsageError('unknown option ' + arg);
    }
  }
  if (opts.help || opts.version) return opts;
  if (opts.only && opts.disable) throw new UsageError('use --only or --disable, not both');
  if (opts.inPlace && opts.check) throw new UsageError('--in-place and --check cannot be used together');
  if (opts.inPlace && opts.files.length === 0) throw new UsageError('--in-place needs at least one file');
  if (opts.inPlace && opts.files.includes('-')) throw new UsageError('--in-place cannot rewrite standard input');
  if (!opts.inPlace && !opts.json && !opts.check && opts.files.length > 1) {
    throw new UsageError('give one input, or use --in-place, --json or --check for several files');
  }
  if (opts.files.filter((f) => f === '-').length > 1) throw new UsageError('standard input (-) can be given only once');
  return opts;
}

function categoryOptions(opts) {
  if (opts.only) return Object.fromEntries(categories.map((c) => [c, opts.only.includes(c)]));
  if (opts.disable) return Object.fromEntries(opts.disable.map((c) => [c, false]));
  return undefined;
}

function decode(buf) {
  if (buf.includes(0)) return { skip: 'binary file (contains NUL bytes)' };
  try {
    return { text: new TextDecoder('utf-8', { fatal: true, ignoreBOM: true }).decode(buf) };
  } catch {
    return { skip: 'not valid UTF-8' };
  }
}

function lineStarts(text) {
  const starts = [0];
  for (let i = text.indexOf('\n'); i !== -1; i = text.indexOf('\n', i + 1)) starts.push(i + 1);
  return starts;
}

function position(starts, offset) {
  let lo = 0;
  let hi = starts.length - 1;
  while (lo < hi) {
    const mid = (lo + hi + 1) >> 1;
    if (starts[mid] <= offset) lo = mid; else hi = mid - 1;
  }
  return { line: lo + 1, column: offset - starts[lo] + 1 };
}

function writeInPlace(path, text) {
  const real = realpathSync(path);
  const mode = statSync(real).mode & 0o7777;
  const tmp = join(dirname(real), '.' + basename(real) + '.secret-redactor-' + process.pid + '.tmp');
  try {
    writeFileSync(tmp, text, { flag: 'wx' });
    chmodSync(tmp, mode);
    renameSync(tmp, real);
  } catch (err) {
    try { unlinkSync(tmp); } catch { /* tmp was not created */ }
    throw err;
  }
}

function readInput(file, stdin) {
  return file === '-' ? stdin() : readFileSync(file);
}

function run(argv, io) {
  let opts;
  try {
    opts = parseArgs(argv);
  } catch (err) {
    if (!(err instanceof UsageError)) throw err;
    io.stderr('secret-redactor: ' + err.message + '\nRun secret-redactor --help for usage.\n');
    return EXIT_USAGE;
  }
  if (opts.help) { io.stdout(HELP); return EXIT_OK; }
  if (opts.version) { io.stdout(io.version + '\n'); return EXIT_OK; }

  const files = opts.files.length ? opts.files : ['-'];
  if (files.includes('-') && io.stdinIsTTY) {
    io.stderr('secret-redactor: no input. Pipe text to standard input or give a file.\nRun secret-redactor --help for usage.\n');
    return EXIT_USAGE;
  }
  const single = !opts.inPlace && !opts.json && !opts.check;
  const redactOptions = { categories: categoryOptions(opts), placeholder: opts.placeholder, maxLength: opts.maxLength };
  try {
    redact('', redactOptions);
  } catch (err) {
    io.stderr('secret-redactor: ' + err.message + '\n');
    return EXIT_USAGE;
  }

  const report = { files: [], skipped: [], errors: [] };
  let total = 0;
  let filesWithFindings = 0;

  for (const file of files) {
    const name = file === '-' ? '-' : file;
    const label = file === '-' ? '<stdin>' : file;
    let buf;
    try {
      buf = readInput(file, io.readStdin);
    } catch (err) {
      report.errors.push({ path: name, message: err.code ? err.code + ': ' + err.message : err.message });
      io.stderr('secret-redactor: ' + label + ': cannot read (' + (err.code || err.message) + ')\n');
      continue;
    }
    const decoded = decode(buf);
    if (decoded.skip) {
      if (single) {
        report.errors.push({ path: name, message: decoded.skip });
        io.stderr('secret-redactor: ' + label + ': ' + decoded.skip + '\n');
      } else {
        report.skipped.push({ path: name, reason: decoded.skip });
        io.stderr('secret-redactor: ' + label + ': skipped, ' + decoded.skip + '\n');
      }
      continue;
    }
    let result;
    try {
      result = redact(decoded.text, redactOptions);
    } catch (err) {
      if (err.code !== 'ERR_INPUT_TOO_LONG') throw err;
      report.errors.push({ path: name, message: err.message });
      io.stderr('secret-redactor: ' + label + ': ' + err.message + '\n');
      continue;
    }

    total += result.findings.length;
    if (result.findings.length) filesWithFindings++;
    const starts = lineStarts(decoded.text);
    const findings = result.findings.map((f) => ({
      rule: f.rule,
      category: f.category,
      placeholder: f.placeholder,
      ...position(starts, f.start),
      start: f.start,
      end: f.end,
    }));
    report.files.push({ path: name, findings });

    if (single) {
      io.stdout(result.text);
    } else if (opts.check && !opts.json) {
      for (const f of findings) io.stderr(label + ':' + f.line + ':' + f.column + ': ' + f.rule + ' (' + f.category + ') -> ' + f.placeholder + '\n');
    }
    if (opts.inPlace && result.text !== decoded.text) {
      try {
        writeInPlace(file, result.text);
        if (!opts.json) io.stderr(label + ': redacted ' + findings.length + ' ' + (findings.length === 1 ? 'secret' : 'secrets') + '\n');
      } catch (err) {
        report.errors.push({ path: name, message: err.code ? err.code + ': ' + err.message : err.message });
        io.stderr('secret-redactor: ' + label + ': cannot write (' + (err.code || err.message) + ')\n');
      }
    }
  }

  if (opts.json) io.stdout(JSON.stringify(report, null, 2) + '\n');
  if (opts.check && !opts.json) {
    io.stderr(total
      ? 'secret-redactor: ' + total + ' ' + (total === 1 ? 'secret' : 'secrets') + ' found in ' + filesWithFindings + ' ' + (filesWithFindings === 1 ? 'input' : 'inputs') + '\n'
      : 'secret-redactor: no secrets found\n');
  }
  if (report.errors.length) return EXIT_INPUT;
  if (opts.check && total) return EXIT_FOUND;
  return EXIT_OK;
}

function main() {
  const pkg = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'));
  const code = run(process.argv.slice(2), {
    stdout: (s) => process.stdout.write(s),
    stderr: (s) => process.stderr.write(s),
    readStdin: () => readFileSync(0),
    stdinIsTTY: Boolean(process.stdin.isTTY),
    version: pkg.version,
  });
  process.exitCode = code;
}

main();
