# secret-redactor

Replace API keys, tokens and passwords in text with numbered placeholders such as `[OPENAI_KEY_1]`. Send the redacted text to an AI assistant. Then put the real values back into the reply.

- No runtime dependencies. Works in Node.js 18 or later and in browsers.
- 30 rules for known credential formats, and an entropy check for random strings.
- A CLI that redacts files or checks text in CI.

A browser version of the same engine is at <https://zerotool.dev/tools/secret-redactor/>. It runs locally in the page.

## The problem

You want help with a log file, a `.env` file or a config. The text contains credentials. If you paste it into a chat, the credentials go to the provider. If you mask every value with `***`, the assistant cannot tell two values apart, and you cannot copy its answer back into your terminal.

This package does three things:

1. It gives each distinct secret its own placeholder. The same value gets the same placeholder everywhere, also when two different rules find it.
2. It does not reuse a placeholder that is already in the text.
3. It restores the placeholders in the reply. Restore accepts the changes that assistants often make: Markdown escapes (`\[SECRET_1\]`), lower case and spaces inside the brackets.

Input:

```text
POSTGRES_PASSWORD=hunter2-staging
DATABASE_URL=postgres://app:hunter2-staging@db:5432/app
OPENAI_API_KEY=sk-proj-0000000000000000000000000000000000000000
MAX_TOKENS=1024
```

Output:

```text
POSTGRES_PASSWORD=[SECRET_1]
DATABASE_URL=postgres://app:[SECRET_1]@db:5432/app
OPENAI_API_KEY=[OPENAI_KEY_1]
MAX_TOKENS=1024
```

The assistant can see that both lines use the same password. `MAX_TOKENS` stays, because a name counts only when it ends in a keyword such as `token`.

## Install

```sh
npm install secret-redactor
```

The package is an ES module. From CommonJS, use `await import('secret-redactor')`, or `require('secret-redactor')` in Node.js 20.19, 22.12 or later.

Run the CLI without an install:

```sh
npx secret-redactor < app.log
```

## API

```js
import { redact, restore } from 'secret-redactor';

const { text, findings, entries } = redact(input);
// text:     the redacted text
// findings: one item per replaced span
// entries:  one item per distinct secret, with the secret value

const reply = await askAssistant(text); // your code

const restored = restore(reply, entries);
// restored.text:     the reply with the real values
// restored.total:    number of placeholders replaced
// restored.distinct: number of different placeholders replaced
// restored.unknown:  placeholders that are not in `entries`, left unchanged
```

With the input above and this reply:

```text
Test the login with `psql postgres://app:\[SECRET_1\]@db:5432/app`.
Then rotate [openai_key_1] and [GITHUB_TOKEN_1].
```

`restore()` returns `total: 2`, `distinct: 2` and `unknown: ['[GITHUB_TOKEN_1]']`. The text is:

```text
Test the login with `psql postgres://app:hunter2-staging@db:5432/app`.
Then rotate sk-proj-0000000000000000000000000000000000000000 and [GITHUB_TOKEN_1].
```

`entries` contains the secrets. Keep it in memory, and do not log it or send it anywhere.

### `redact(text, options?)`

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `categories` | `{ [category]: boolean }` | all `true` | Turn categories off, for example `{ entropy: false }`. Categories that you do not give stay on. An unknown name throws a `TypeError`. |
| `placeholder` | `string` or `(info) => string` | `[{label}_{n}]` | Replacement format. A template can use `{label}`, `{n}`, `{rule}` and `{category}`. A function gets `{ label, n, rule, category }`. `restore()` accepts only the default format. |
| `maxLength` | `number` | `1000000` | Maximum input length in UTF-16 code units. Longer input throws a `RangeError` with `code: 'ERR_INPUT_TOO_LONG'`. Use `Infinity` for no limit. |

Why these options exist:

- `categories` is the same as the category switches in the browser version. Use it to stop a category that flags harmless values.
- `placeholder` is for output that never comes back, for example a log that you share. `n` is the number of the default placeholder, so a template with `{n}` keeps one name per value.
- `maxLength` keeps the limit of the browser version as the default. In the package tests, 1,000,000 characters of log text take about 50 ms in Node.js 24 on a laptop. Raise the limit for larger files.

Result:

```ts
{
  text: string;
  findings: Array<{ rule, category, label, placeholder, start, end }>; // in text order
  entries: Array<{ placeholder, value, label, rule, category, count }>; // one per distinct value
}
```

`start` and `end` are offsets in the input string (UTF-16 code units, `end` exclusive). `findings[i].rule` is the rule that found that span. `entries[i].rule` and `entries[i].label` come from the first span with that value.

### `restore(text, entries)`

`entries` is the array from `redact()`, or any array of `{ placeholder, value }`. Restore replaces `[LABEL_N]`, `\[LABEL_N\]`, `[label_n]` and `[ LABEL_N ]`. It does not replace `LABEL_N` without brackets, `[LABEL_01]` or `[LABEL-N]`, because these can be normal text. Restored values are not scanned again.

### Other exports

- `rules`: `{ id, category, label }` for each rule, in priority order.
- `categories`: `['ai', 'cloud', 'token', 'private-key', 'password', 'entropy']`.
- `DEFAULT_MAX_LENGTH`: `1000000`.

Types are included (`src/index.d.ts`).

## CLI

```text
secret-redactor [options] [file ...]
```

With no file, or when the file is `-`, the CLI reads standard input.

| Option | Description |
|--------|-------------|
| (none) | Write the redacted text to standard output. One input only. |
| `-i`, `--in-place` | Rewrite each file with the redacted text. Files without findings are not written. The file mode stays the same. |
| `--json` | Write the findings as JSON to standard output. |
| `--check` | Write no text. List the findings on standard error. Exit with code 1 if there is a finding. |
| `--only <list>` | Use only these categories, for example `--only ai,cloud`. |
| `--disable <list>` | Turn off these categories, for example `--disable entropy`. |
| `--placeholder <template>` | Replacement format, for example `'<{label}>'`. |
| `--max-length <n>` | Maximum characters per input. Default 1000000. `Infinity` for no limit. |

The CLI never prints a secret value. `--json` and `--check` show the rule, the category, the placeholder and the position:

`app.log` contains the `OPENAI_API_KEY` and `DATABASE_URL` lines from the example above:

```sh
$ secret-redactor --check app.log
app.log:1:16: openai-key (ai) -> [OPENAI_KEY_1]
app.log:2:29: url-credential (password) -> [URL_PASSWORD_1]
secret-redactor: 2 secrets found in 1 input
$ echo $?
1
```

`secret-redactor --json app.log` writes the same findings as JSON (shown here with one finding on each line):

```json
{
  "files": [
    {
      "path": "app.log",
      "findings": [
        { "rule": "openai-key", "category": "ai", "placeholder": "[OPENAI_KEY_1]", "line": 1, "column": 16, "start": 15, "end": 63 },
        { "rule": "url-credential", "category": "password", "placeholder": "[URL_PASSWORD_1]", "line": 2, "column": 29, "start": 92, "end": 107 }
      ]
    }
  ],
  "skipped": [],
  "errors": []
}
```

Lines and columns start at 1. Columns count UTF-16 code units.

Files that contain a NUL byte or are not valid UTF-8 are skipped with a warning when you use `--in-place`, `--json` or `--check`. In the default mode, such input is an error.

### Exit codes

| Code | Meaning |
|------|---------|
| 0 | Success. With `--check`: no findings. |
| 1 | `--check` found at least one secret. |
| 2 | Usage error. No input was read. |
| 3 | An input could not be read, decoded or written, or is longer than `--max-length`. Code 3 has priority over code 1. |

### Example: check a build log before you upload it

```yaml
- run: npx secret-redactor --check build.log
```

## Categories

| Category | Contents |
|----------|----------|
| `ai` | AI provider keys |
| `cloud` | Cloud and SaaS tokens, webhook URLs |
| `token` | JWTs and authorization headers |
| `private-key` | PEM private key blocks |
| `password` | Passwords in URLs, values of names such as `password` or `api_key` |
| `entropy` | Unlabelled random strings |

## Rules

When two rules match the same characters, the rule higher in this table wins. The entropy check runs last.

<!-- RULES:START -->
| Rule | Category | Placeholder | Matches |
|------|----------|-------------|---------|
| `private-key` | `private-key` | `[PRIVATE_KEY_N]` | PEM block from `-----BEGIN … PRIVATE KEY-----` to the matching END line, or to the end of the text if there is no END line. |
| `anthropic-key` | `ai` | `[ANTHROPIC_KEY_N]` | Anthropic API key `sk-ant-…`. |
| `openai-key` | `ai` | `[OPENAI_KEY_N]` | OpenAI key that starts with `sk-proj-`, `sk-svcacct-` or `sk-admin-`. |
| `openai-legacy-key` | `ai` | `[OPENAI_KEY_N]` | Older OpenAI key: `sk-`, 20 characters, `T3BlbkFJ`, 20 characters. |
| `huggingface-token` | `ai` | `[HF_TOKEN_N]` | Hugging Face token `hf_…`. |
| `generic-sk-key` | `ai` | `[API_KEY_N]` | Other key that starts with `sk-` and has 32 or more characters after the prefix. |
| `github-fine-grained-pat` | `cloud` | `[GITHUB_TOKEN_N]` | GitHub fine-grained token `github_pat_…`. |
| `github-token` | `cloud` | `[GITHUB_TOKEN_N]` | GitHub token `ghp_`, `gho_`, `ghu_`, `ghs_` or `ghr_`. |
| `gitlab-pat` | `cloud` | `[GITLAB_TOKEN_N]` | GitLab personal access token `glpat-…`. |
| `slack-webhook` | `cloud` | `[SLACK_WEBHOOK_N]` | Slack webhook URL under `https://hooks.slack.com/services/`, `/workflows/` or `/triggers/`. |
| `slack-token` | `cloud` | `[SLACK_TOKEN_N]` | Slack token `xoxb-`, `xoxp-`, `xoxa-`, `xoxo-`, `xoxs-` or `xoxr-`. |
| `stripe-secret-key` | `cloud` | `[STRIPE_KEY_N]` | Stripe secret or restricted key `sk_live_`, `sk_test_`, `rk_live_` or `rk_test_`. Publishable `pk_` keys stay. |
| `stripe-webhook-secret` | `cloud` | `[STRIPE_WEBHOOK_SECRET_N]` | Stripe webhook signing secret `whsec_…`. |
| `aws-access-key-id` | `cloud` | `[AWS_ACCESS_KEY_N]` | AWS access key ID: `AKIA`, `ASIA`, `ABIA` or `ACCA` and 16 characters. |
| `aws-secret-access-key` | `cloud` | `[AWS_SECRET_KEY_N]` | AWS secret access key: a 40-character value after a name that contains `aws` and `secret`. |
| `google-api-key` | `cloud` | `[GOOGLE_API_KEY_N]` | Google API key `AIza…`. |
| `google-oauth-secret` | `cloud` | `[GOOGLE_OAUTH_SECRET_N]` | Google OAuth client secret `GOCSPX-…`. |
| `sendgrid-key` | `cloud` | `[SENDGRID_KEY_N]` | SendGrid API key `SG.….…`. |
| `npm-token` | `cloud` | `[NPM_TOKEN_N]` | npm token `npm_…`. |
| `pypi-token` | `cloud` | `[PYPI_TOKEN_N]` | PyPI API token `pypi-AgEIcHlwaS5vcmc…`. |
| `telegram-bot-token` | `cloud` | `[TELEGRAM_BOT_TOKEN_N]` | Telegram bot token `<bot id>:AA…`. |
| `feishu-webhook` | `cloud` | `[FEISHU_HOOK_TOKEN_N]` | Token in a Feishu or Lark bot webhook URL (`open.feishu.cn` or `open.larksuite.com`, path `/open-apis/bot/v2/hook/`). The URL stays. |
| `wecom-webhook-key` | `cloud` | `[WECOM_WEBHOOK_KEY_N]` | The `key` value in a WeCom webhook URL (`qyapi.weixin.qq.com/cgi-bin/webhook/…?key=`). The URL stays. |
| `jwt` | `token` | `[JWT_N]` | JSON Web Token `eyJ….eyJ….…`. |
| `kintone-password-auth` | `token` | `[KINTONE_AUTH_N]` | Value of the kintone `X-Cybozu-Authorization` header when it is the Base64 of `login:password`. |
| `kakao-rest-api-key` | `token` | `[KAKAO_API_KEY_N]` | Kakao REST API key after the `KakaoAK` scheme. The scheme stays. |
| `basic-auth-header` | `token` | `[BASIC_AUTH_N]` | Credential in `Authorization: Basic …`. The header name and scheme stay. |
| `bearer-token` | `token` | `[BEARER_TOKEN_N]` | Token after `Bearer`. The scheme stays. |
| `url-credential` | `password` | `[URL_PASSWORD_N]` | Password in a URL such as `postgres://user:password@host`. User, host and path stay. |
| `keyed-secret` | `password` | `[SECRET_N]` | Value assigned to a name that ends in `password`, `passwd`, `pwd`, `secret`, `token`, `api_key`, `access_key`, `private_key`, `client_secret`, `auth_token` or `credentials`. Skips `${VAR}`, `<…>`, `{{…}}`, values of one repeated character, and words such as `true` and `null`. |
| `high-entropy` | `entropy` | `[HIGH_ENTROPY_N]` | Unlabelled run of 32 or more base64 characters with upper case, lower case and digits, and 4.2 or more bits of entropy per character. Skips paths, `sha512-` hashes, `data:` URIs and certificate or public key blocks. |
<!-- RULES:END -->

## Limits

- **Detection is limited.** There are 30 rules and an entropy check. The gitleaks default config had 222 rules in September 2026. A secret in a format that is not in the table, with no telling variable name, and shorter than 32 characters is not found. Read the redacted text before you send it.
- **Every rule except the private key rule stops at the end of a line.** A token that is wrapped onto two lines is not found.
- **Hex strings are not flagged by the entropy check.** This keeps git SHAs and checksums readable. A hex-only token is found only after a name such as `token=`.
- **False positives occur.** A long CamelCase identifier with a digit, such as `AbstractSingletonProxyFactoryBean2Impl`, is flagged as high entropy. Turn off the `entropy` category if this is a problem.
- **No personal data.** Email addresses, names, phone numbers, IP addresses and host names stay.
- **No live check.** The package does not test if a key is still valid, because that means sending the key to the provider.
- **Placeholder numbers depend on the categories.** Restore with the `entries` of the same `redact()` call.

### How this package is different from secret scanners

Use a secret scanner to find secrets in a repository or in git history:

- [gitleaks](https://github.com/gitleaks/gitleaks) and [TruffleHog](https://github.com/trufflesecurity/trufflehog) scan files and git history with many more rules. TruffleHog can also test if a key is live.
- [secretlint](https://github.com/secretlint/secretlint) is a linter for secrets in files, with rule packages.

These tools report findings. They do not give you a redacted copy, and they do not restore values. This package is for the step before you paste text somewhere: one placeholder per value, and a way back. Use it together with a scanner, not in place of one.

## Relation to the browser version

The detection and restore code in `src/engine.js` is a copy of the engine in the ZeroTool browser tool. The two are kept the same: a test compares them, and rule changes are made in the browser tool first. Results from the package and from the web page are the same for the same input and the same categories.

## License

MIT
