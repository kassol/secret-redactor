/** Detection categories. Each rule belongs to one category. */
export type Category = 'ai' | 'cloud' | 'token' | 'private-key' | 'password' | 'entropy';

export interface RuleInfo {
  /** Rule id, for example `openai-key`. */
  readonly id: string;
  readonly category: Category;
  /** Label used in the default placeholder, for example `OPENAI_KEY`. */
  readonly label: string;
}

export interface PlaceholderInfo {
  /** Label of the first rule that matched this value. */
  label: string;
  /** Number of the default placeholder `[LABEL_N]`. */
  n: number;
  rule: string;
  category: Category;
}

export interface RedactOptions {
  /** Turn categories on or off. Categories that are not given stay on. */
  categories?: Partial<Record<Category, boolean>>;
  /**
   * Replacement format. Default: `[LABEL_N]`, which `restore()` can reverse.
   * A string template can use `{label}`, `{n}`, `{rule}` and `{category}`.
   * `restore()` does not accept entries with a custom placeholder.
   */
  placeholder?: string | ((info: PlaceholderInfo) => string);
  /**
   * Maximum input length in UTF-16 code units. Default: 1,000,000.
   * Longer input throws a RangeError with `code: 'ERR_INPUT_TOO_LONG'`.
   */
  maxLength?: number;
}

export interface Finding {
  /** Id of the rule that matched this span. */
  rule: string;
  category: Category;
  label: string;
  /** Placeholder that replaced this span. */
  placeholder: string;
  /** Start offset in the input, in UTF-16 code units. */
  start: number;
  /** End offset (exclusive) in the input, in UTF-16 code units. */
  end: number;
}

export interface Entry {
  placeholder: string;
  /** The secret itself. Do not log or send it. */
  value: string;
  label: string;
  /** Id of the first rule that matched this value. */
  rule: string;
  category: Category;
  /** Number of times the value occurs in the redacted spans. */
  count: number;
}

export interface RedactResult {
  /** The text with each secret replaced by its placeholder. */
  text: string;
  /** One item per replaced span, in text order. */
  findings: Finding[];
  /** One item per distinct secret value. Contains the secrets. */
  entries: Entry[];
}

export interface RestoreResult {
  text: string;
  /** Number of placeholders that were replaced. */
  total: number;
  /** Number of different placeholders that were replaced. */
  distinct: number;
  /** Placeholders in `[LABEL_N]` form that are not in the mapping. They stay unchanged. */
  unknown: string[];
}

export declare const DEFAULT_MAX_LENGTH: number;
export declare const categories: readonly Category[];
export declare const rules: readonly RuleInfo[];

export declare function redact(text: string, options?: RedactOptions): RedactResult;
export declare function restore(
  text: string,
  entries: ReadonlyArray<{ placeholder: string; value: string }>,
): RestoreResult;
