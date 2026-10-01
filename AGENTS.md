# AGENTS.md — secret-redactor

> AI 协作约定，纳入 git 管理。面向用户的说明见 `README.md`（英文）。

## 项目概述

npm 包 `secret-redactor`：把文本里的 API 密钥、令牌、密码换成编号占位符（`[OPENAI_KEY_1]`），同值同占位符；拿回 AI 回复后按映射还原。附 CLI，可用于脱敏文件或在 CI 中检查文本。

- 引擎来自 ZeroTool 的浏览器工具 secret-redactor（zerotool-dev 仓库 `src/components/tools/SecretRedactorTool.astro`，`engine:start` / `engine:end` 之间），本仓库逐字复制，不在这里改规则。
- 零运行时依赖；Node ≥ 18 与浏览器都能用（入口 `src/index.js` 不 import 任何 Node 模块，CLI 在 `bin/`）。
- 浏览器版链接在 README 中只出现一处（https://zerotool.dev/tools/secret-redactor/）。

## 技术栈

| 层 | 选型 | 说明 |
|----|------|------|
| 语言 | 纯 JavaScript（ESM）+ 手写 `.d.ts` | 不用 TypeScript 源码：引擎必须与组件内联脚本逐字一致，加编译步骤后同步检查只能比对编译产物；不编译则测试的就是发布的文件 |
| 测试 | `node --test` | 无测试框架依赖 |
| 类型检查 | `typescript`（devDependency） | 只用来编译检查 `typecheck/index.ts`（引用 `src/index.d.ts`），不产出文件 |
| 运行时依赖 | 无 | `package.json` 不得出现 `dependencies` |

## 目录索引

| 路径 | 职责 |
|------|------|
| `src/engine.js` | 生成文件：组件引擎块逐字复制（去掉 4 格缩进）+ 导出行。不要手改，用 `npm run sync` 重新生成 |
| `src/index.js` | 公开 API：`redact` / `restore` / `rules` / `categories` / `DEFAULT_MAX_LENGTH` |
| `src/index.d.ts` | 类型声明，与 `src/index.js` 同步维护 |
| `bin/secret-redactor.js` | CLI |
| `scripts/sync-engine.mjs` | 从 zerotool-dev 复制引擎块；`--check` 只比对，不一致退出 1 |
| `scripts/rules-table.mjs` | 由 `rules` 生成 README 规则表（`<!-- RULES:START -->` 与 `<!-- RULES:END -->` 之间）；`--check` 只比对 |
| `test/` | `*.test.js`，`node --test` 自动发现：`engine`（迁移自 zerotool-dev 的引擎用例）、`api`、`cli`、`docs`（README 规则表与示例输出）、`sync` |
| `typecheck/index.ts` | 类型声明的编译检查（含 `@ts-expect-error` 反例）。放在 `test/` 之外：Node 24 的 `node --test` 会执行 `test/` 下的 `.ts` |
| `.github/workflows/ci.yml` | push / PR 时在 Node 18 / 20 / 22 / 24 上跑测试与类型检查 |

## 常用命令

```bash
npm test                  # node --test
npm run typecheck         # tsc --noEmit
npm run sync              # 从 ../zerotool-dev 重新生成 src/engine.js（或 ZEROTOOL_DEV_DIR=/path）
npm run sync:check        # 比对 src/engine.js 与组件引擎块，不一致退出 1
npm run rules:readme      # 重写 README 规则表
npm pack --dry-run        # 查看将发布的文件与体积
```

## 全局规范

1. **规则同源**：规则与占位符逻辑只在 zerotool-dev 的组件里改。改规则的流程：
   1. 在 zerotool-dev 改 `SecretRedactorTool.astro` 引擎块，跑它的 `scripts/test-secret-redactor.mjs`。
   2. 在本仓库跑 `npm run sync`，再跑 `npm run rules:readme`（新增规则要先在 `scripts/rules-table.mjs` 的 `DESCRIPTIONS` 补一句说明，缺了脚本报错）。
   3. 把 zerotool-dev 新增的测试用例迁到 `test/engine.test.js`，跑 `npm test`。
   4. 按语义化版本发版：新增规则或检测范围变化为 minor，误报修正为 patch。
   - `test/sync.test.js` 在找得到 zerotool-dev 时比对两边，不一致即失败；找不到（CI、他人机器）时跳过并说明原因。
2. **测试数据**：fixture 不得出现符合任何云厂商密钥格式的字面量（GitHub 推送保护会拦）。用 `'sk-' + 'proj-' + ...` 这类运行时拼接，或全 0 / `EXAMPLE` 填充。
3. **新增 API 选项**：只加组件已有语义的封装；新增选项在 `README.md` 与本文件变更日志写明理由。
4. **CLI 不输出密钥原文**：`--json` 与 `--check` 只输出规则、类别、占位符与位置。
5. **commit message**：英文，`feat/fix/chore/docs/test(scope): description`，遵循 ASD-STE100。

## 发布（尚未执行，需决策人确认）

前置：决策人给出 GitHub 仓库地址，替换 `package.json` 的 `repository.url`、`homepage`、`bugs`（当前为 `OWNER` 占位）。trusted publishing 要求 `repository.url` 与 GitHub 仓库完全一致。

npm 的 trusted publisher 在包的 Settings 页配置，包须先存在。流程：

1. 首次发布（本地，需 npm 账号与 2FA）：`npm publish --access public`。本地发布不带 provenance。
2. npmjs.com → 包 → Settings → Trusted Publisher → GitHub Actions：填 owner、仓库名、workflow 文件名 `publish.yml`。
3. 在仓库加 `.github/workflows/publish.yml`：`on: push: tags: ['v*']`，`permissions: { id-token: write, contents: read }`，Node 24（trusted publishing 要求 npm CLI ≥ 11.5.1、Node ≥ 22.14.0），步骤 `npm ci` → `npm test` → `npm publish`。通过 trusted publishing 从公开仓库发布时 npm 自动生成 provenance，不需要 `--provenance`。
4. 包 Settings → Publishing access 选 "Require two-factor authentication and disallow tokens"。
5. 之后发版：改 `version` → commit → 打 `vX.Y.Z` tag → push tag。

出处：docs.npmjs.com/trusted-publishers（2026-10-01 读取）。

## 变更日志

- 2026-10-01 — 初始化。引擎同步自 zerotool-dev `c37473f`（30 条规则 + 高熵检测）。API：`redact(text, options)`（选项 `categories`、`placeholder`、`maxLength`）、`restore(text, entries)`；CLI：stdin / 文件、`--in-place`、`--json`、`--check`、`--only` / `--disable`、`--placeholder`、`--max-length`。测试由 zerotool-dev `scripts/test-secret-redactor.mjs` 迁移并补 API、CLI、同步、README 规则表与示例测试，共 133 项（Node 18 / 20 / 24 实跑通过）。
