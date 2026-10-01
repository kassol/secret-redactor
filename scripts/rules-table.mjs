// Write the rule table in README.md from the exported `rules`.
//
// Read:  src/index.js (rules), README.md
// Write: README.md, between <!-- RULES:START --> and <!-- RULES:END --> (not with --check)
// Exit:  0 on success or when --check finds no difference; 1 when --check finds a
//        difference, a rule has no description, or a description has no rule
//
// Run: node scripts/rules-table.mjs [--check]

import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { rules } from '../src/index.js';

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const README = join(root, 'README.md');
const START = '<!-- RULES:START -->';
const END = '<!-- RULES:END -->';

// One sentence per rule. Add a line here when the engine gets a new rule.
export const DESCRIPTIONS = {
  'private-key': 'PEM block from `-----BEGIN … PRIVATE KEY-----` to the matching END line, or to the end of the text if there is no END line.',
  'anthropic-key': 'Anthropic API key `sk-ant-…`.',
  'openai-key': 'OpenAI key that starts with `sk-proj-`, `sk-svcacct-` or `sk-admin-`.',
  'openai-legacy-key': 'Older OpenAI key: `sk-`, 20 characters, `T3BlbkFJ`, 20 characters.',
  'huggingface-token': 'Hugging Face token `hf_…`.',
  'generic-sk-key': 'Other key that starts with `sk-` and has 32 or more characters after the prefix.',
  'github-fine-grained-pat': 'GitHub fine-grained token `github_pat_…`.',
  'github-token': 'GitHub token `ghp_`, `gho_`, `ghu_`, `ghs_` or `ghr_`.',
  'gitlab-pat': 'GitLab personal access token `glpat-…`.',
  'slack-webhook': 'Slack webhook URL under `https://hooks.slack.com/services/`, `/workflows/` or `/triggers/`.',
  'slack-token': 'Slack token `xoxb-`, `xoxp-`, `xoxa-`, `xoxo-`, `xoxs-` or `xoxr-`.',
  'stripe-secret-key': 'Stripe secret or restricted key `sk_live_`, `sk_test_`, `rk_live_` or `rk_test_`. Publishable `pk_` keys stay.',
  'stripe-webhook-secret': 'Stripe webhook signing secret `whsec_…`.',
  'aws-access-key-id': 'AWS access key ID: `AKIA`, `ASIA`, `ABIA` or `ACCA` and 16 characters.',
  'aws-secret-access-key': 'AWS secret access key: a 40-character value after a name that contains `aws` and `secret`.',
  'google-api-key': 'Google API key `AIza…`.',
  'google-oauth-secret': 'Google OAuth client secret `GOCSPX-…`.',
  'sendgrid-key': 'SendGrid API key `SG.….…`.',
  'npm-token': 'npm token `npm_…`.',
  'pypi-token': 'PyPI API token `pypi-AgEIcHlwaS5vcmc…`.',
  'telegram-bot-token': 'Telegram bot token `<bot id>:AA…`.',
  'feishu-webhook': 'Token in a Feishu or Lark bot webhook URL (`open.feishu.cn` or `open.larksuite.com`, path `/open-apis/bot/v2/hook/`). The URL stays.',
  'wecom-webhook-key': 'The `key` value in a WeCom webhook URL (`qyapi.weixin.qq.com/cgi-bin/webhook/…?key=`). The URL stays.',
  'jwt': 'JSON Web Token `eyJ….eyJ….…`.',
  'kintone-password-auth': 'Value of the kintone `X-Cybozu-Authorization` header when it is the Base64 of `login:password`.',
  'kakao-rest-api-key': 'Kakao REST API key after the `KakaoAK` scheme. The scheme stays.',
  'basic-auth-header': 'Credential in `Authorization: Basic …`. The header name and scheme stay.',
  'bearer-token': 'Token after `Bearer`. The scheme stays.',
  'url-credential': 'Password in a URL such as `postgres://user:password@host`. User, host and path stay.',
  'keyed-secret': 'Value assigned to a name that ends in `password`, `passwd`, `pwd`, `secret`, `token`, `api_key`, `access_key`, `private_key`, `client_secret`, `auth_token` or `credentials`. Skips `${VAR}`, `<…>`, `{{…}}`, values of one repeated character, and words such as `true` and `null`.',
  'high-entropy': 'Unlabelled run of 32 or more base64 characters with upper case, lower case and digits, and 4.2 or more bits of entropy per character. Skips paths, `sha512-` hashes, `data:` URIs and certificate or public key blocks.',
};

export function buildTable() {
  const missing = rules.filter((r) => !DESCRIPTIONS[r.id]).map((r) => r.id);
  const extra = Object.keys(DESCRIPTIONS).filter((id) => !rules.some((r) => r.id === id));
  if (missing.length || extra.length) {
    throw new Error('rule descriptions out of date. Missing: ' + (missing.join(', ') || 'none') + '. Unknown: ' + (extra.join(', ') || 'none') + '.');
  }
  const rows = rules.map((r) => '| `' + r.id + '` | `' + r.category + '` | `[' + r.label + '_N]` | ' + DESCRIPTIONS[r.id].replace(/\|/g, '\\|') + ' |');
  return [
    '| Rule | Category | Placeholder | Matches |',
    '|------|----------|-------------|---------|',
    ...rows,
  ].join('\n');
}

export function renderReadme(readme) {
  const start = readme.indexOf(START);
  const end = readme.indexOf(END);
  if (start < 0 || end <= start) throw new Error('README.md has no ' + START + ' … ' + END + ' block');
  return readme.slice(0, start + START.length) + '\n' + buildTable() + '\n' + readme.slice(end);
}

function main(argv) {
  const readme = readFileSync(README, 'utf8');
  let next;
  try {
    next = renderReadme(readme);
  } catch (err) {
    console.error('rules-table: ' + err.message);
    return 1;
  }
  if (argv.includes('--check')) {
    if (next === readme) return 0;
    console.error('rules-table: README.md rule table is out of date. Run `npm run rules:readme`.');
    return 1;
  }
  if (next !== readme) writeFileSync(README, next);
  console.log('rules-table: README.md has ' + rules.length + ' rules');
  return 0;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  process.exitCode = main(process.argv.slice(2));
}
