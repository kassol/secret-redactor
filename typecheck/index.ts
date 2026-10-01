// Compile-only check of src/index.d.ts (npm run typecheck). Outside test/ so that node --test does not run it.

import { redact, restore, rules, categories, DEFAULT_MAX_LENGTH } from 'secret-redactor';
import type { Category, Entry, Finding, RedactOptions, RedactResult, RestoreResult, RuleInfo } from 'secret-redactor';

const options: RedactOptions = {
  categories: { entropy: false, ai: true },
  placeholder: (info) => '<' + info.label + '_' + info.n + ':' + info.rule + ':' + info.category + '>',
  maxLength: Infinity,
};
const result: RedactResult = redact('password=hunter22', options);
const text: string = result.text;
const finding: Finding | undefined = result.findings[0];
const entry: Entry | undefined = result.entries[0];
const start: number | undefined = finding?.start;
const value: string | undefined = entry?.value;

const back: RestoreResult = restore(text, result.entries);
const unknown: string[] = back.unknown;
restore('x', [{ placeholder: '[SECRET_1]', value: 'v' }]);
redact('x', { placeholder: '[{label}_{n}]' });
redact('x');

const firstRule: RuleInfo | undefined = rules[0];
const cat: Category | undefined = categories[0];
const max: number = DEFAULT_MAX_LENGTH;

// @ts-expect-error unknown category
redact('x', { categories: { pii: false } });
// @ts-expect-error placeholder must return a string
redact('x', { placeholder: () => 1 });
// @ts-expect-error rules is read-only
rules.push({ id: 'x', category: 'ai', label: 'X' });
// @ts-expect-error entries need a value
restore('x', [{ placeholder: '[A_1]' }]);

export { start, value, unknown, firstRule, cat, max };
