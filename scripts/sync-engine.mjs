// Copy the detection / restore engine from the ZeroTool browser tool into src/engine.js.
//
// Read:  <zerotool-dev>/src/components/tools/SecretRedactorTool.astro (the code between
//        the `engine:start` and `engine:end` markers)
// Write: src/engine.js (not with --check)
// Exit:  0 on success or when --check finds no difference; 1 when --check finds a
//        difference or the source cannot be read
//
// <zerotool-dev> is, in order: --source <dir>, $ZEROTOOL_DEV_DIR, ../zerotool-dev.
//
// Run: node scripts/sync-engine.mjs [--check] [--source <dir>]

import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = dirname(dirname(fileURLToPath(import.meta.url)));
export const COMPONENT_PATH = 'src/components/tools/SecretRedactorTool.astro';
export const ENGINE_PATH = join(root, 'src/engine.js');
const START_MARK = '/* ── engine:start ── */';
const END_MARK = '/* ── engine:end ── */';
const INDENT = '    ';
const EXPORTS = ['LIMIT', 'RULES', 'ENTROPY_RULE', 'CATEGORY_IDS', 'PH_EXACT', 'detect', 'restore'];

export function sourceDir(argv = [], env = process.env) {
  const i = argv.indexOf('--source');
  if (i !== -1 && argv[i + 1]) return resolve(argv[i + 1]);
  if (env.ZEROTOOL_DEV_DIR) return resolve(env.ZEROTOOL_DEV_DIR);
  return resolve(root, '..', 'zerotool-dev');
}

export function componentFile(dir) {
  return join(dir, COMPONENT_PATH);
}

// Returns the text of src/engine.js for a given component source.
export function buildEngine(componentSource) {
  const start = componentSource.indexOf(START_MARK);
  const end = componentSource.indexOf(END_MARK);
  if (start < 0 || end <= start) throw new Error('engine markers not found in ' + COMPONENT_PATH);
  const lines = componentSource.slice(start + START_MARK.length, end).split('\n');
  while (lines.length && lines[0].trim() === '') lines.shift();
  while (lines.length && lines[lines.length - 1].trim() === '') lines.pop();
  const body = lines.map((line, n) => {
    if (line.trim() === '') return '';
    if (!line.startsWith(INDENT)) throw new Error('engine line ' + (n + 1) + ' is not indented by 4 spaces');
    return line.slice(INDENT.length);
  });
  const missing = EXPORTS.filter((name) => !new RegExp('\\b(?:var|function) ' + name + '\\b').test(body.join('\n')));
  if (missing.length) throw new Error('engine block no longer declares: ' + missing.join(', '));
  return [
    '// GENERATED FILE. Do not edit.',
    '// Source: zerotool-dev ' + COMPONENT_PATH + ', the code between the',
    '// `engine:start` and `engine:end` markers, with 4 spaces of indentation removed.',
    '// Regenerate with `npm run sync`. Compare with `npm run sync:check`.',
    '',
    ...body,
    '',
    'export { ' + EXPORTS.join(', ') + ' };',
    '',
  ].join('\n');
}

function main(argv) {
  const check = argv.includes('--check');
  const dir = sourceDir(argv);
  const file = componentFile(dir);
  if (!existsSync(file)) {
    console.error('sync-engine: cannot find ' + file + '. Set --source or ZEROTOOL_DEV_DIR.');
    return 1;
  }
  const expected = buildEngine(readFileSync(file, 'utf8'));
  const current = existsSync(ENGINE_PATH) ? readFileSync(ENGINE_PATH, 'utf8') : '';
  if (check) {
    if (current === expected) {
      console.log('sync-engine: src/engine.js matches ' + file);
      return 0;
    }
    console.error('sync-engine: src/engine.js differs from ' + file + '. Run `npm run sync`.');
    return 1;
  }
  if (current === expected) {
    console.log('sync-engine: src/engine.js is up to date');
  } else {
    writeFileSync(ENGINE_PATH, expected);
    console.log('sync-engine: wrote src/engine.js from ' + file);
  }
  return 0;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  process.exitCode = main(process.argv.slice(2));
}
