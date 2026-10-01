// Public API. The detection and restore logic is in ./engine.js, which is copied
// from the ZeroTool browser tool and must not be edited here (see AGENTS.md).
// Types: ./index.d.ts.

import { LIMIT, RULES, ENTROPY_RULE, CATEGORY_IDS, PH_EXACT, detect, restore as restoreEngine } from './engine.js';

export const DEFAULT_MAX_LENGTH = LIMIT;

export const categories = Object.freeze(CATEGORY_IDS.slice());

export const rules = Object.freeze(
  RULES.concat([ENTROPY_RULE]).map((rule) => Object.freeze({ id: rule.id, category: rule.cat, label: rule.label })),
);

const TEMPLATE_TOKEN = /\{(\w*)\}/g;
const TEMPLATE_FIELDS = ['label', 'n', 'rule', 'category'];

function resolveCategories(input) {
  const enabled = {};
  for (const id of CATEGORY_IDS) enabled[id] = true;
  if (input === undefined || input === null) return enabled;
  if (typeof input !== 'object' || Array.isArray(input)) {
    throw new TypeError('options.categories must be an object such as { entropy: false }');
  }
  for (const key of Object.keys(input)) {
    if (!CATEGORY_IDS.includes(key)) {
      throw new TypeError('Unknown category "' + key + '". Known categories: ' + CATEGORY_IDS.join(', '));
    }
    if (typeof input[key] !== 'boolean') throw new TypeError('options.categories.' + key + ' must be a boolean');
    enabled[key] = input[key];
  }
  return enabled;
}

function resolveMaxLength(input) {
  if (input === undefined) return LIMIT;
  if (typeof input !== 'number' || Number.isNaN(input) || input < 0) {
    throw new TypeError('options.maxLength must be a number >= 0 (use Infinity for no limit)');
  }
  return input;
}

// Returns null for the default [LABEL_N] format, or a function(info) => string.
function resolvePlaceholder(input) {
  if (input === undefined || input === null) return null;
  if (typeof input === 'function') {
    return (info) => {
      const out = input(info);
      if (typeof out !== 'string') throw new TypeError('options.placeholder must return a string');
      return out;
    };
  }
  if (typeof input === 'string') {
    for (const m of input.matchAll(TEMPLATE_TOKEN)) {
      if (!TEMPLATE_FIELDS.includes(m[1])) {
        throw new TypeError('Unknown placeholder field {' + m[1] + '}. Use {label}, {n}, {rule} or {category}.');
      }
    }
    return (info) => input.replace(TEMPLATE_TOKEN, (_, key) => String(info[key]));
  }
  throw new TypeError('options.placeholder must be a string template or a function');
}

export function redact(text, options) {
  if (typeof text !== 'string') throw new TypeError('redact(): text must be a string');
  const opts = options ?? {};
  if (typeof opts !== 'object') throw new TypeError('redact(): options must be an object');
  const enabled = resolveCategories(opts.categories);
  const maxLength = resolveMaxLength(opts.maxLength);
  const format = resolvePlaceholder(opts.placeholder);

  if (text.length > maxLength) {
    const err = new RangeError('Input is ' + text.length + ' characters; the limit is ' + maxLength + '. Split the text or raise options.maxLength.');
    err.code = 'ERR_INPUT_TOO_LONG';
    throw err;
  }

  const result = detect(text, enabled);
  const byEngineEntry = new Map();
  const entries = result.entries.map((e) => {
    const n = Number(/_(\d+)\]$/.exec(e.ph)[1]);
    const placeholder = format ? format({ label: e.label, n, rule: e.rule, category: e.cat }) : e.ph;
    const entry = { placeholder, value: e.value, label: e.label, rule: e.rule, category: e.cat, count: e.count };
    byEngineEntry.set(e, entry);
    return entry;
  });

  const findings = result.hits.map((h) => ({
    rule: h.rule.id,
    category: h.rule.cat,
    label: h.rule.label,
    placeholder: byEngineEntry.get(h.entry).placeholder,
    start: h.s,
    end: h.e,
  }));

  let output = result.output;
  if (format) {
    const parts = [];
    let cursor = 0;
    for (const h of result.hits) {
      parts.push(text.slice(cursor, h.s), byEngineEntry.get(h.entry).placeholder);
      cursor = h.e;
    }
    parts.push(text.slice(cursor));
    output = parts.join('');
  }

  return { text: output, findings, entries };
}

export function restore(text, entries) {
  if (typeof text !== 'string') throw new TypeError('restore(): text must be a string');
  if (!Array.isArray(entries)) throw new TypeError('restore(): entries must be the array from redact().entries');
  const mapping = entries.map((e, i) => {
    if (!e || typeof e.placeholder !== 'string' || typeof e.value !== 'string') {
      throw new TypeError('restore(): entries[' + i + '] must have string placeholder and value');
    }
    if (!PH_EXACT.test(e.placeholder)) {
      throw new TypeError('restore(): entries[' + i + '].placeholder "' + e.placeholder + '" is not a default [LABEL_N] placeholder. restore() supports only the default format.');
    }
    return { ph: e.placeholder, value: e.value };
  });
  const r = restoreEngine(text, mapping);
  return { text: r.text, total: r.total, distinct: r.distinct, unknown: r.unknown };
}
