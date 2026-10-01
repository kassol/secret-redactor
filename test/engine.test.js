// Detection, placeholder and restore behavior through the public API.
//
// Migrated from zerotool-dev scripts/test-secret-redactor.mjs. Each case there has a
// case here with the same input and the same expected result.
//
// Token-shaped fixtures are assembled at runtime so that no literal secret-shaped
// string is in the repository (push protection, repository scanners).

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Buffer } from 'node:buffer';
import { redact, restore, rules, categories, DEFAULT_MAX_LENGTH } from '../src/index.js';

const only = (...cats) => Object.fromEntries(categories.map((c) => [c, cats.includes(c)]));
const run = (text, enabled) => redact(text, enabled ? { categories: enabled } : undefined);
const summary = (r) => JSON.stringify(r.entries.map((x) => [x.rule, x.value]));

// Random-looking bodies (mixed case + digits) built at runtime.
const B32 = 'Q9vXmT2kLp8RwZ4nYb7Hc1Js5Df3Ga6E';
const B36 = 'Ab3De6Gh9Jk2Mn5Pq8St1Vw4Yz7Bc0Ef3Hi6';
const B40 = B32 + 'u0KiWoPq';
// Local-service credentials: obviously fake values in the documented shapes.
const FEISHU_TOKEN = '00000000-0000-0000-0000-00000EXAMPLE';
const WECOM_KEY = '00000000-EXAM-PLE0-0000-000000000000';
const KINTONE_AUTH = Buffer.from('EXAMPLE:EXAMPLE').toString('base64');
const KAKAO_KEY = '0000EXAMPLE0000EXAMPLE0000000000';

// ---------- 1. every rule: positive ----------
// [rule id, text, expected redacted value]
const positives = [
  ['private-key', 'k:\n' + '-----BEGIN ' + 'OPENSSH PRIVATE KEY-----\nb3BlbnNzaC1rZXktdjEAAAAA\n-----END OPENSSH PRIVATE KEY-----\nafter',
    '-----BEGIN ' + 'OPENSSH PRIVATE KEY-----\nb3BlbnNzaC1rZXktdjEAAAAA\n-----END OPENSSH PRIVATE KEY-----'],
  ['anthropic-key', 'key ' + 'sk-' + 'ant-api03-' + B32 + ' end', 'sk-' + 'ant-api03-' + B32],
  ['openai-key', 'key ' + 'sk-' + 'proj-' + B40 + ' end', 'sk-' + 'proj-' + B40],
  ['openai-legacy-key', 'key ' + 'sk-' + 'Ab3De6Gh9Jk2Mn5Pq8St' + 'T3Blbk' + 'FJ' + 'u0KiWoPqNrLs7Xy2Za9B' + ' end', 'sk-' + 'Ab3De6Gh9Jk2Mn5Pq8St' + 'T3Blbk' + 'FJ' + 'u0KiWoPqNrLs7Xy2Za9B'],
  ['huggingface-token', 'hf ' + 'hf' + '_' + B36 + ' end', 'hf' + '_' + B36],
  ['generic-sk-key', 'deepseek ' + 'sk-' + 'or-v1-' + B40 + ' end', 'sk-' + 'or-v1-' + B40],
  ['github-fine-grained-pat', 'pat ' + 'github' + '_pat_' + (B40 + B40 + 'x').slice(0, 82) + ' end', 'github' + '_pat_' + (B40 + B40 + 'x').slice(0, 82)],
  ['github-token', 'gh ' + 'gh' + 'p_' + B36 + ' end', 'gh' + 'p_' + B36],
  ['gitlab-pat', 'gl ' + 'gl' + 'pat-' + 'Ab3De6Gh9Jk2Mn5Pq8St' + ' end', 'gl' + 'pat-' + 'Ab3De6Gh9Jk2Mn5Pq8St'],
  ['slack-webhook', 'hook https://hooks.slack.com/services/' + 'T000/B000/' + B32 + ' end', 'https://hooks.slack.com/services/' + 'T000/B000/' + B32],
  ['slack-token', 'slack ' + 'xo' + 'xb-' + '1234567890-abcdEFGH' + ' end', 'xo' + 'xb-' + '1234567890-abcdEFGH'],
  ['stripe-secret-key', 'stripe ' + 'sk' + '_live_' + 'Ab3De6Gh9Jk2Mn5P' + ' end', 'sk' + '_live_' + 'Ab3De6Gh9Jk2Mn5P'],
  ['stripe-webhook-secret', 'wh ' + 'wh' + 'sec_' + 'Ab3De6Gh9Jk2Mn5Pq8St1Vw4' + ' end', 'wh' + 'sec_' + 'Ab3De6Gh9Jk2Mn5Pq8St1Vw4'],
  ['aws-access-key-id', 'id ' + 'AKIA' + 'IOSFODNN7EXAMPLE' + ' end', 'AKIA' + 'IOSFODNN7EXAMPLE'],
  ['aws-secret-access-key', 'AWS_SECRET_ACCESS_KEY=' + 'wJalrXUtnFEMI/K7MDENG/' + 'bPxRfiCYEXAMPLEKEY', 'wJalrXUtnFEMI/K7MDENG/' + 'bPxRfiCYEXAMPLEKEY'],
  ['google-api-key', 'g ' + 'AI' + 'za' + 'Ab3De6Gh9Jk2Mn5Pq8St1Vw4Yz7Bc0Ef3Hi' + ' end', 'AI' + 'za' + 'Ab3De6Gh9Jk2Mn5Pq8St1Vw4Yz7Bc0Ef3Hi'],
  ['google-oauth-secret', 'g ' + 'GOC' + 'SPX-' + 'Ab3De6Gh9Jk2Mn5Pq8St1Vw4Yz7B' + ' end', 'GOC' + 'SPX-' + 'Ab3De6Gh9Jk2Mn5Pq8St1Vw4Yz7B'],
  ['sendgrid-key', 'sg ' + 'SG' + '.' + 'Ab3De6Gh9Jk2Mn5Pq8St1V' + '.' + 'Ab3De6Gh9Jk2Mn5Pq8St1Vw4Yz7Bc0Ef3Hi6Kl9Mn2P' + ' end', 'SG' + '.' + 'Ab3De6Gh9Jk2Mn5Pq8St1V' + '.' + 'Ab3De6Gh9Jk2Mn5Pq8St1Vw4Yz7Bc0Ef3Hi6Kl9Mn2P'],
  ['npm-token', 'npm ' + 'np' + 'm_' + B36 + ' end', 'np' + 'm_' + B36],
  ['pypi-token', 'pypi ' + 'pypi-' + 'AgEIcHlwaS5vcmc' + B40 + B32 + ' end', 'pypi-' + 'AgEIcHlwaS5vcmc' + B40 + B32],
  ['telegram-bot-token', 'bot ' + '123456789:' + 'AA' + 'Ab3De6Gh9Jk2Mn5Pq8St1Vw4Yz7Bc0Ef3' + ' end', '123456789:' + 'AA' + 'Ab3De6Gh9Jk2Mn5Pq8St1Vw4Yz7Bc0Ef3'],
  ['jwt', 'jwt ' + 'ey' + 'JhbGciOiJIUzI1NiJ9' + '.ey' + 'JzdWIiOiIxMjM0In0' + '.' + 'sig_Ab3De6' + ' end', 'ey' + 'JhbGciOiJIUzI1NiJ9' + '.ey' + 'JzdWIiOiIxMjM0In0' + '.' + 'sig_Ab3De6'],
  ['basic-auth-header', 'Authorization: Basic ' + 'dXNlcjpwYXNzd29yZA==', 'dXNlcjpwYXNzd29yZA=='],
  ['bearer-token', 'Authorization: Bearer ' + 'opaque.token-value_12345', 'opaque.token-value_12345'],
  ['url-credential', 'DATABASE_URL=postgres://app:' + 'hunter2x' + '@db:5432/app', 'hunter2x'],
  ['keyed-secret', 'db_password: "' + 'correcthorse' + '"', 'correcthorse'],
  ['feishu-webhook', 'curl -X POST https://open.feishu.cn/open-apis/bot/v2/hook/' + FEISHU_TOKEN + " -d '{}'", FEISHU_TOKEN],
  ['wecom-webhook-key', "curl 'https://qyapi.weixin.qq.com/cgi-bin/webhook/send?key=" + WECOM_KEY + "'", WECOM_KEY],
  ['kintone-password-auth', 'curl -H "X-Cybozu-Authorization: ' + KINTONE_AUTH + '" https://example.cybozu.com/k/v1/record.json', KINTONE_AUTH],
  ['kakao-rest-api-key', 'curl -H "Authorization: KakaoAK ' + KAKAO_KEY + '" https://dapi.kakao.com/v2/local/search/address.json', KAKAO_KEY],
];

for (const [id, text, value] of positives) {
  test('positive ' + id, () => {
    const r = run(text);
    const e = r.entries.find((x) => x.value === value);
    assert.ok(e && e.rule === id, summary(r));
    assert.ok(!r.text.includes(value), 'value still in output');
  });
}

test('every rule has a positive case', () => {
  const missing = rules.filter((rule) => rule.id !== 'high-entropy' && !positives.some((p) => p[0] === rule.id));
  assert.deepEqual(missing, []);
});

test('positive high-entropy', () => {
  const v = 'Zq8Xw3Rt6Yp1Lm4Nk7Jh2Gf5Dd9Sa0Qb3';
  const r = run('value: x ' + v + ' done', only('entropy'));
  assert.equal(r.entries.length, 1, JSON.stringify(r.entries));
  assert.equal(r.entries[0].value, v);
  assert.equal(r.entries[0].placeholder, '[HIGH_ENTROPY_1]');
});

// ---------- 2. known false-positive negatives ----------
const negatives = [
  ['git SHA (40 hex)', 'commit 9fceb02d0ae598e95dc970b74767f19372d61af8 merged'],
  ['sha256 digest', 'sha256:e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855'],
  ['UUID', 'request 123e4567-e89b-12d3-a456-426614174000 done'],
  ['max_tokens', 'max_tokens: 1024'],
  ['token_count', 'token_count=12'],
  ['env reference', 'DB_PASSWORD=${DB_PASS}'],
  ['template placeholder', 'api_key: "<your-api-key>"'],
  ['mustache placeholder', 'secret: {{ .Values.secret }}'],
  ['masked stars', 'password: ********'],
  ['boolean value', 'require_token: true'],
  ['npm integrity', '"integrity": "sha512-' + 'Ab3De6Gh9Jk2Mn5Pq8St1Vw4Yz7Bc0Ef3Hi6Kl9Mn2Pq5St8Vw1Yz4Bc7Ef0Hi3Kl6=="'],
  ['data URI', 'src="data:image/png;base64,' + 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg=="'],
  ['mixed-case path', 'at src/components/tools/SecretRedactorTool2Astro/renderOutput.js'],
  ['certificate block', '-----BEGIN CERTIFICATE-----\nMIIDdzCCAl+gAwIBAgIEAgAAuTANBgkqhkiG9w0BAQUFADBaMQswCQYDVQQGEwJJ\n-----END CERTIFICATE-----'],
  ['stripe publishable key', 'pk' + '_live_' + 'Ab3De6Gh9Jk2Mn5P'],
  ['placeholder-looking text', 'see [SECRET_1] and [OPENAI_KEY_2]'],
];
for (const [name, text] of negatives) {
  test('negative ' + name, () => {
    assert.equal(run(text).entries.length, 0);
  });
}

// ---------- 2b. local-service credentials: variants and look-alikes ----------
test('lark webhook host', () => {
  const r = run('POST https://open.larksuite.com/open-apis/bot/v2/hook/' + FEISHU_TOKEN);
  assert.ok(r.entries.length === 1 && r.entries[0].rule === 'feishu-webhook', summary(r));
});
test('feishu keeps the URL, masks the token', () => {
  assert.equal(run('https://open.feishu.cn/open-apis/bot/v2/hook/' + FEISHU_TOKEN).text, 'https://open.feishu.cn/open-apis/bot/v2/hook/[FEISHU_HOOK_TOKEN_1]');
});
test('wecom upload_media, key after another param', () => {
  const r = run('POST https://qyapi.weixin.qq.com/cgi-bin/webhook/upload_media?type=file&key=' + WECOM_KEY);
  assert.ok(r.entries.length === 1 && r.entries[0].value === WECOM_KEY, summary(r));
});
test('wecom keeps the URL, masks the key', () => {
  assert.equal(run('https://qyapi.weixin.qq.com/cgi-bin/webhook/send?key=' + WECOM_KEY).text, 'https://qyapi.weixin.qq.com/cgi-bin/webhook/send?key=[WECOM_WEBHOOK_KEY_1]');
});
test('kintone header in JSON', () => {
  const r = run('{"X-Cybozu-Authorization": "' + KINTONE_AUTH + '"}');
  assert.ok(r.entries.length === 1 && r.entries[0].rule === 'kintone-password-auth', summary(r));
});
test('KakaoAK in a Python dict', () => {
  const r = run("headers = {'authorization': 'KakaoAK " + KAKAO_KEY + "'}");
  assert.ok(r.entries.length === 1 && r.entries[0].rule === 'kakao-rest-api-key', summary(r));
});
test('KakaoAK keeps the scheme', () => {
  assert.equal(run('Authorization: KakaoAK ' + KAKAO_KEY).text, 'Authorization: KakaoAK [KAKAO_API_KEY_1]');
});

const localNegatives = [
  ['feishu doc placeholder ****', 'https://open.feishu.cn/open-apis/bot/v2/hook/****'],
  ['feishu doc placeholder xxxx', 'https://open.feishu.cn/open-apis/bot/v2/hook/xxxxxxxxxxxxxxxxx'],
  ['feishu other open-apis path', 'https://open.feishu.cn/open-apis/im/v1/messages?receive_id_type=open_id'],
  ['feishu hook on another host', 'https://example.com/open-apis/bot/v2/hook/' + FEISHU_TOKEN.replace(/0/g, '1')],
  ['wecom placeholder KEY', 'https://qyapi.weixin.qq.com/cgi-bin/webhook/upload_media?key=KEY&type=TYPE'],
  ['wecom env reference', 'https://qyapi.weixin.qq.com/cgi-bin/webhook/send?key=${WECOM_KEY}'],
  ['wecom other API with key=', 'https://qyapi.weixin.qq.com/cgi-bin/gettoken?corpid=ww0000&corpsecret=${S}&key=abcdefgh1234'],
  ['key= on another host', 'https://example.com/search?key=Ab3De6Gh9Jk2'],
  ['kintone env reference', 'X-Cybozu-Authorization: ${KINTONE_AUTH}'],
  ['kintone btoa call', "'X-Cybozu-Authorization': btoa(user + ':' + pass)"],
  ['kintone variable name', "'X-Cybozu-Authorization': encodedCredentials"],
  ['kintone base64 without colon', 'X-Cybozu-Authorization: ' + Buffer.from('no-colon-here').toString('base64')],
  ['kintone header name in prose', 'Set the X-Cybozu-Authorization header to the Base64 of login:password.'],
  ['kakao env reference', 'Authorization: KakaoAK ${REST_API_KEY}'],
  ['kakao doc placeholder', 'Authorization: KakaoAK {REST_API_KEY}'],
  ['kakao bare placeholder', 'Authorization: KakaoAK REST_API_KEY'],
  ['kakao in prose', 'Send the key with the KakaoAK scheme in the Authorization header.'],
];
for (const [name, text] of localNegatives) {
  test('negative ' + name, () => {
    assert.equal(run(text).entries.length, 0);
  });
}

test('keyed rule skips scheme word Bearer', () => {
  const r = run('client_secret: Bearer ' + 'opaque.token-value_12345');
  assert.ok(r.entries.length === 1 && r.entries[0].rule === 'bearer-token', summary(r));
});
test('aws_access_key_id is not keyed-secret', () => {
  const r = run('aws_access_key_id=' + 'AKIA' + 'IOSFODNN7EXAMPLE');
  assert.ok(r.entries.length === 1 && r.entries[0].rule === 'aws-access-key-id', summary(r));
});

// ---------- 3. placeholders ----------
test('same value gets one entry and one placeholder', () => {
  const key = 'sk-' + 'proj-' + B40;
  const r = run('A=' + key + '\nlog: ' + key + '\nagain ' + key);
  assert.equal(r.entries.length, 1);
  assert.equal(r.entries[0].count, 3);
  assert.equal(r.findings.length, 3);
  assert.equal(r.text, 'A=[OPENAI_KEY_1]\nlog: [OPENAI_KEY_1]\nagain [OPENAI_KEY_1]');
});
test('per-label numbering', () => {
  assert.equal(run('password=first1 password=second2 password=first1').text, 'password=[SECRET_1] password=[SECRET_2] password=[SECRET_1]');
});
test('overlap: openai-key wins over generic, keyed and entropy rules', () => {
  const r = run('OPENAI_API_KEY=' + 'sk-' + 'proj-' + B40);
  assert.ok(r.entries.length === 1 && r.entries[0].rule === 'openai-key' && r.entries[0].label === 'OPENAI_KEY', summary(r));
  assert.equal(r.text, 'OPENAI_API_KEY=[OPENAI_KEY_1]');
});
test('overlap: jwt wins over bearer', () => {
  const jwt = 'ey' + 'JhbGciOiJIUzI1NiJ9' + '.ey' + 'JzdWIiOiIxMjM0In0' + '.' + 'sig_Ab3De6';
  const r = run('Authorization: Bearer ' + jwt);
  assert.ok(r.entries.length === 1 && r.entries[0].rule === 'jwt', summary(r));
});
test('category off: a lower-priority rule takes the value', () => {
  const r = run('OPENAI_API_KEY=' + 'sk-' + 'proj-' + B40, only('password'));
  assert.ok(r.entries.length === 1 && r.entries[0].rule === 'keyed-secret', summary(r));
  assert.equal(run('OPENAI_API_KEY=' + 'sk-' + 'proj-' + B40, only()).entries.length, 0);
});
test('placeholder already in the input is skipped in numbering and never restored', () => {
  const r = run('existing [SECRET_1] here; password=hunter22');
  assert.equal(r.text, 'existing [SECRET_1] here; password=[SECRET_2]');
  assert.equal(restore('rotate [SECRET_2]; ignore [SECRET_1]', r.entries).text, 'rotate hunter22; ignore [SECRET_1]');
});
test('re-run on redacted text finds nothing; CRLF kept', () => {
  const text = [
    'OPENAI_API_KEY=' + 'sk-' + 'proj-' + B40,
    'DATABASE_URL=postgres://app:' + 'S3cure!Pass42' + '@db:5432/app',
    'Authorization: Bearer ' + 'opaque.token-value_12345',
  ].join('\r\n');
  const once = run(text);
  const twice = run(once.text);
  assert.equal(twice.entries.length, 0);
  assert.equal(twice.text, once.text);
  assert.equal(once.text.split('\r\n').length, 3);
});
test('private key without an END line is redacted to the end of the text', () => {
  const r = run('k ' + '-----BEGIN ' + 'RSA PRIVATE KEY-----\nMIIEpAIBAAKCAQEA\nno end marker');
  assert.equal(r.entries.length, 1);
  assert.equal(r.text, 'k [PRIVATE_KEY_1]');
});
test('surrogate pairs and CJK stay intact', () => {
  assert.equal(run('日本語 🙂 password=hunter22 中文').text, '日本語 🙂 password=[SECRET_1] 中文');
});

// ---------- 4. restore ----------
{
  const key = 'sk-' + 'proj-' + B40;
  const pw = 'S3cure!Pass42';
  const text = 'OPENAI_API_KEY=' + key + '\nDATABASE_URL=postgres://app:' + pw + '@db:5432/app';
  const r = run(text);

  test('round trip restores the input exactly', () => {
    const back = restore(r.text, r.entries);
    assert.equal(back.text, text);
    assert.equal(back.total, 2);
    assert.equal(back.distinct, 2);
    assert.deepEqual(back.unknown, []);
  });
  test('restore accepts escaped, lower-case, spaced and code-quoted placeholders', () => {
    const v = restore('a [OPENAI_KEY_1] b \\[OPENAI_KEY_1\\] c [openai_key_1] d [ OPENAI_KEY_1 ] e `[OPENAI_KEY_1]`', r.entries);
    assert.equal(v.text, 'a ' + key + ' b ' + key + ' c ' + key + ' d ' + key + ' e `' + key + '`');
    assert.equal(v.total, 5);
  });
  test('restore leaves rewritten placeholders unchanged', () => {
    const rejected = 'OPENAI_KEY_1 and [OPENAI_KEY_01] and [OPENAI-KEY-1]';
    const rj = restore(rejected, r.entries);
    assert.equal(rj.text, rejected);
    assert.equal(rj.total, 0);
  });
  test('restore reports invented placeholders and counts distinct ones', () => {
    const partial = restore('rotate [OPENAI_KEY_1] and [PASSWORD_7], also [OPENAI_KEY_1]', r.entries);
    assert.equal(partial.total, 2);
    assert.equal(partial.distinct, 1);
    assert.deepEqual(partial.unknown, ['[PASSWORD_7]']);
    assert.ok(partial.text.includes('[PASSWORD_7]'));
  });
  test('restore without placeholders returns the text unchanged', () => {
    const empty = restore('no placeholders here', r.entries);
    assert.equal(empty.total, 0);
    assert.equal(empty.text, 'no placeholders here');
  });
}
test('a restored value is not scanned again', () => {
  const nested = restore('[URL_PASSWORD_1]', [{ placeholder: '[URL_PASSWORD_1]', value: '[OPENAI_KEY_1]' }, { placeholder: '[OPENAI_KEY_1]', value: 'x' }]);
  assert.equal(nested.text, '[OPENAI_KEY_1]');
});

// ---------- 5. 1,000,000 characters ----------
test('1,000,000 characters: exact round trip in under 1000 ms', () => {
  const lines = [
    '2026-09-23T10:12:03Z INFO request id=123e4567-e89b-12d3-a456-426614174000 commit=9fceb02d0ae598e95dc970b74767f19372d61af8 max_tokens=1024 path=/v1/chat/completions',
    '2026-09-23T10:12:04Z WARN Authorization: Bearer ' + 'opaque.token-value_12345' + ' user=alice status=401',
    '2026-09-23T10:12:05Z INFO connecting postgres://app:' + 'S3cure!Pass42' + '@db.internal:5432/app retry=3',
    '2026-09-23T10:12:06Z DEBUG OPENAI_API_KEY=' + 'sk-' + 'proj-' + B40 + ' model=gpt-x',
    '2026-09-23T10:12:07Z DEBUG blob=Zq8Xw3Rt6Yp1Lm4Nk7Jh2Gf5Dd9Sa0Qb3 digest=sha256:e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
  ];
  let big = '';
  let i = 0;
  while (big.length < DEFAULT_MAX_LENGTH) big += lines[i++ % lines.length] + '\n';
  big = big.slice(0, DEFAULT_MAX_LENGTH);
  const t0 = performance.now();
  const r = run(big);
  const t1 = performance.now();
  assert.ok(restore(r.text, r.entries).text === big, 'round trip differs');
  assert.ok(t1 - t0 < 1000, (t1 - t0).toFixed(1) + ' ms');
});
