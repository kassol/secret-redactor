// GENERATED FILE. Do not edit.
// Source: zerotool-dev src/components/tools/SecretRedactorTool.astro, the code between the
// `engine:start` and `engine:end` markers, with 4 spaces of indentation removed.
// Regenerate with `npm run sync`. Compare with `npm run sync:check`.

var LIMIT = 1000000;
var RULES = [
  { id: 'private-key', cat: 'private-key', label: 'PRIVATE_KEY', re: /-----BEGIN[A-Z0-9 ]*PRIVATE KEY(?: BLOCK)?-----[\s\S]*?(?:-----END[A-Z0-9 ]*PRIVATE KEY(?: BLOCK)?-----|$(?![\s\S]))/gd },
  { id: 'anthropic-key', cat: 'ai', label: 'ANTHROPIC_KEY', re: /\bsk-ant-[a-z]{3,6}\d{2}-[A-Za-z0-9_-]{32,}/gd },
  { id: 'openai-key', cat: 'ai', label: 'OPENAI_KEY', re: /\bsk-(?:proj|svcacct|admin)-[A-Za-z0-9_-]{32,}/gd },
  { id: 'openai-legacy-key', cat: 'ai', label: 'OPENAI_KEY', re: /\bsk-[A-Za-z0-9]{20}T3BlbkFJ[A-Za-z0-9]{20}\b/gd },
  { id: 'huggingface-token', cat: 'ai', label: 'HF_TOKEN', re: /\bhf_[A-Za-z0-9]{34,}\b/gd },
  { id: 'generic-sk-key', cat: 'ai', label: 'API_KEY', re: /\bsk-[A-Za-z0-9][A-Za-z0-9_-]{31,}/gd },
  { id: 'github-fine-grained-pat', cat: 'cloud', label: 'GITHUB_TOKEN', re: /\bgithub_pat_[A-Za-z0-9_]{80,}/gd },
  { id: 'github-token', cat: 'cloud', label: 'GITHUB_TOKEN', re: /\bgh[pousr]_[A-Za-z0-9]{36,}\b/gd },
  { id: 'gitlab-pat', cat: 'cloud', label: 'GITLAB_TOKEN', re: /\bglpat-[A-Za-z0-9_-]{20,}/gd },
  { id: 'slack-webhook', cat: 'cloud', label: 'SLACK_WEBHOOK', re: /https:\/\/hooks\.slack\.com\/(?:services|workflows|triggers)\/[A-Za-z0-9+/_-]{20,}/gd },
  { id: 'slack-token', cat: 'cloud', label: 'SLACK_TOKEN', re: /\bxox[abposr]-[A-Za-z0-9-]{10,}/gd },
  { id: 'stripe-secret-key', cat: 'cloud', label: 'STRIPE_KEY', re: /\b(?:sk|rk)_(?:live|test)_[A-Za-z0-9]{16,}\b/gd },
  { id: 'stripe-webhook-secret', cat: 'cloud', label: 'STRIPE_WEBHOOK_SECRET', re: /\bwhsec_[A-Za-z0-9+/=]{24,}/gd },
  { id: 'aws-access-key-id', cat: 'cloud', label: 'AWS_ACCESS_KEY', re: /\b(?:AKIA|ASIA|ABIA|ACCA)[A-Z2-7]{16}\b/gd },
  { id: 'aws-secret-access-key', cat: 'cloud', label: 'AWS_SECRET_KEY', re: /aws.{0,20}?secret.{0,20}?['"]?\s*[:=]\s*['"]?([A-Za-z0-9/+]{40})(?![A-Za-z0-9/+])/gdi },
  { id: 'google-api-key', cat: 'cloud', label: 'GOOGLE_API_KEY', re: /\bAIza[A-Za-z0-9_-]{35}(?![A-Za-z0-9_-])/gd },
  { id: 'google-oauth-secret', cat: 'cloud', label: 'GOOGLE_OAUTH_SECRET', re: /\bGOCSPX-[A-Za-z0-9_-]{28}(?![A-Za-z0-9_-])/gd },
  { id: 'sendgrid-key', cat: 'cloud', label: 'SENDGRID_KEY', re: /\bSG\.[A-Za-z0-9_-]{22}\.[A-Za-z0-9_-]{43}(?![A-Za-z0-9_-])/gd },
  { id: 'npm-token', cat: 'cloud', label: 'NPM_TOKEN', re: /\bnpm_[A-Za-z0-9]{36}\b/gd },
  { id: 'pypi-token', cat: 'cloud', label: 'PYPI_TOKEN', re: /\bpypi-AgEIcHlwaS5vcmc[A-Za-z0-9_-]{50,}/gd },
  { id: 'telegram-bot-token', cat: 'cloud', label: 'TELEGRAM_BOT_TOKEN', re: /\b\d{8,10}:AA[A-Za-z0-9_-]{33}(?![A-Za-z0-9_-])/gd },
  // Feishu / Lark custom bot: https://open.feishu.cn/open-apis/bot/v2/hook/{token}
  { id: 'feishu-webhook', cat: 'cloud', label: 'FEISHU_HOOK_TOKEN', check: notFiller, re: /\bopen\.(?:feishu\.cn|larksuite\.com)\/open-apis\/bot\/v2\/hook\/([A-Za-z0-9_-]{8,})/gd },
  // WeCom message push: https://qyapi.weixin.qq.com/cgi-bin/webhook/send?key={key}
  { id: 'wecom-webhook-key', cat: 'cloud', label: 'WECOM_WEBHOOK_KEY', check: notFiller, re: /\bqyapi\.weixin\.qq\.com\/cgi-bin\/webhook\/[A-Za-z_]+\?(?:[^\s#'"]*?&)?key=([A-Za-z0-9-]{8,})(?![A-Za-z0-9_-])/gd },
  { id: 'jwt', cat: 'token', label: 'JWT', re: /\beyJ[A-Za-z0-9_-]{8,}\.eyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]*/gd },
  // kintone password auth: Base64 of "login:password"
  { id: 'kintone-password-auth', cat: 'token', label: 'KINTONE_AUTH', check: base64HasColon, re: /\bX-Cybozu-Authorization['"]?\s*[:=]\s*['"]?((?:[A-Za-z0-9+/]{4})+(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?)(?![A-Za-z0-9+/=(])/gdi },
  // Kakao REST API key: Authorization: KakaoAK {key}
  { id: 'kakao-rest-api-key', cat: 'token', label: 'KAKAO_API_KEY', check: notFiller, re: /\bKakaoAK\s+([A-Za-z0-9]{16,})(?![A-Za-z0-9_-])/gdi },
  { id: 'basic-auth-header', cat: 'token', label: 'BASIC_AUTH', re: /\bAuthorization\s*[:=]\s*['"]?Basic\s+([A-Za-z0-9+/]{8,}={0,2})/gdi },
  { id: 'bearer-token', cat: 'token', label: 'BEARER_TOKEN', re: /\bBearer\s+([A-Za-z0-9._~+/-]{16,}={0,2})/gdi },
  { id: 'url-credential', cat: 'password', label: 'URL_PASSWORD', re: /\b[a-z][a-z0-9+.-]{1,30}:\/\/[^\s:/?#@'"]+:([^\s/?#@'"]+)@/gdi },
  { id: 'keyed-secret', cat: 'password', label: 'SECRET', keyed: true, re: /(?:^|[\s{,;(&?'"])[A-Za-z0-9_.-]{0,40}?(?:password|passwd|pwd|secret|secret[_-]?key|token|api[_-]?key|apikey|access[_-]?key|private[_-]?key|client[_-]?secret|auth[_-]?token|credentials?)['"]?\s*(?::|=|:=|=>)\s*['"]?([^\s'"`,;]{4,})/gdmi },
];
var ENTROPY_RULE = { id: 'high-entropy', cat: 'entropy', label: 'HIGH_ENTROPY' };
var CATEGORY_IDS = ['ai', 'cloud', 'token', 'private-key', 'password', 'entropy'];

var PH_EXACT = /^\[[A-Z][A-Z0-9_]*_\d+\]$/;
var PH_ANY = /\[[A-Z][A-Z0-9_]*_\d+\]/g;
// `bearer` / `basic` added to the spec list: in `"token": "Bearer eyJ…"` the keyed
// rule would otherwise mask the scheme word while rule 24 masks the credential.
var KEYED_STOPWORDS = ['true', 'false', 'null', 'none', 'nil', 'undefined', 'required', 'optional', 'bearer', 'basic'];

function keyedValueOk(v) {
  if (v[0] === '$' || v[0] === '%') return false;
  if (/^<.*>$/.test(v) || /^\{\{.*\}\}$/.test(v)) return false;
  if (/^(.)\1*$/.test(v)) return false;
  if (KEYED_STOPWORDS.indexOf(v.toLowerCase()) !== -1) return false;
  return true;
}

// Rejects doc placeholders such as `xxxxxxxx` or `0000-0000`: one repeated
// character once hyphens are removed.
function notFiller(v) {
  return !/^(.)\1*$/.test(v.replace(/-/g, ''));
}

function base64HasColon(v) {
  try { return atob(v).indexOf(':') > 0; } catch (e) { return false; }
}

function shannon(s) {
  var freq = {};
  for (var i = 0; i < s.length; i++) freq[s[i]] = (freq[s[i]] || 0) + 1;
  var h = 0;
  for (var k in freq) {
    var p = freq[k] / s.length;
    h -= p * Math.log2(p);
  }
  return h;
}

function publicPemRanges(text) {
  var ranges = [];
  var re = /-----BEGIN (CERTIFICATE|CERTIFICATE REQUEST|PUBLIC KEY|X509 CRL)-----[\s\S]*?-----END \1-----/g;
  var m;
  while ((m = re.exec(text)) !== null) ranges.push([m.index, m.index + m[0].length]);
  return ranges;
}

function entropyHits(text) {
  var out = [];
  var pem = publicPemRanges(text);
  var re = /[A-Za-z0-9+/_-]{32,}={0,2}/g;
  var m;
  while ((m = re.exec(text)) !== null) {
    var run = m[0].replace(/=+$/, '');
    var start = m.index;
    if (!/[A-Z]/.test(run) || !/[a-z]/.test(run) || !/[0-9]/.test(run)) continue;
    if (shannon(run) < 4.2) continue;
    var pathSegs = run.split('/').filter(function (seg) { return /^[a-z][a-z0-9_-]{2,}$/.test(seg); });
    if (pathSegs.length >= 2) continue;
    if (/^sha(?:1|256|384|512)-/.test(run)) continue;
    if (text.slice(Math.max(0, start - 7), start) === 'base64,') continue;
    var inPem = false;
    for (var i = 0; i < pem.length; i++) {
      if (start >= pem[i][0] && start < pem[i][1]) { inPem = true; break; }
    }
    if (inPem) continue;
    out.push({ s: start, e: start + m[0].length });
  }
  return out;
}

// Returns { hits, output, entries }. hits: accepted spans in text order, each with
// its entry; entries: one per distinct value { ph, value, label, rule, cat, count }.
function detect(text, enabled) {
  var raw = [];
  for (var r = 0; r < RULES.length; r++) {
    var rule = RULES[r];
    if (!enabled[rule.cat]) continue;
    rule.re.lastIndex = 0;
    var m;
    while ((m = rule.re.exec(text)) !== null) {
      if (m[0].length === 0) { rule.re.lastIndex++; continue; }
      var span = m.indices[1] || m.indices[0];
      var value = text.slice(span[0], span[1]);
      if (PH_EXACT.test(value)) continue;
      if (rule.keyed && !keyedValueOk(value)) continue;
      if (rule.check && !rule.check(value)) continue;
      raw.push({ p: r, s: span[0], e: span[1], rule: rule });
    }
  }
  if (enabled.entropy) {
    var eh = entropyHits(text);
    for (var j = 0; j < eh.length; j++) raw.push({ p: RULES.length, s: eh[j].s, e: eh[j].e, rule: ENTROPY_RULE });
  }

  raw.sort(function (a, b) { return a.p - b.p || a.s - b.s || (b.e - b.s) - (a.e - a.s); });
  var taken = new Uint8Array(text.length);
  var hits = [];
  for (var h = 0; h < raw.length; h++) {
    var hit = raw[h];
    var free = true;
    for (var x = hit.s; x < hit.e; x++) { if (taken[x]) { free = false; break; } }
    if (!free) continue;
    taken.fill(1, hit.s, hit.e);
    hits.push(hit);
  }
  hits.sort(function (a, b) { return a.s - b.s; });

  var existing = new Set(text.match(PH_ANY) || []);
  var valueToEntry = new Map();
  var counters = {};
  var entries = [];
  var parts = [];
  var cursor = 0;
  for (var k = 0; k < hits.length; k++) {
    var cur = hits[k];
    var val = text.slice(cur.s, cur.e);
    var entry = valueToEntry.get(val);
    if (!entry) {
      var label = cur.rule.label;
      var n = counters[label] || 0;
      var ph;
      do { n++; ph = '[' + label + '_' + n + ']'; } while (existing.has(ph));
      counters[label] = n;
      entry = { ph: ph, value: val, label: label, rule: cur.rule.id, cat: cur.rule.cat, count: 0 };
      valueToEntry.set(val, entry);
      entries.push(entry);
    }
    entry.count++;
    cur.entry = entry;
    parts.push(text.slice(cursor, cur.s), entry.ph);
    cursor = cur.e;
  }
  parts.push(text.slice(cursor));
  return { hits: hits, output: parts.join(''), entries: entries };
}

// Returns { parts, text, total, distinct, unknown }. parts: strings, or
// { value } objects for restored spans.
function restore(reply, entries) {
  var lookup = new Map();
  for (var i = 0; i < entries.length; i++) lookup.set(entries[i].ph.slice(1, -1), entries[i].value);
  var re = /\\?\[\s*([A-Za-z][A-Za-z0-9_]*_\d+)\s*\\?\]/g;
  var parts = [];
  var used = new Set();
  var unknown = [];
  var total = 0;
  var cursor = 0;
  var m;
  while ((m = re.exec(reply)) !== null) {
    var key = m[1].toUpperCase();
    if (lookup.has(key)) {
      parts.push(reply.slice(cursor, m.index), { value: lookup.get(key) });
      cursor = m.index + m[0].length;
      total++;
      used.add(key);
    } else if (/^[A-Z][A-Z0-9_]*_\d+$/.test(m[1]) && unknown.indexOf('[' + m[1] + ']') === -1) {
      unknown.push('[' + m[1] + ']');
    }
  }
  parts.push(reply.slice(cursor));
  var text = parts.map(function (p) { return typeof p === 'string' ? p : p.value; }).join('');
  return { parts: parts, text: text, total: total, distinct: used.size, unknown: unknown };
}

export { LIMIT, RULES, ENTROPY_RULE, CATEGORY_IDS, PH_EXACT, detect, restore };
