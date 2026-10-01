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
| `.github/workflows/ci.yml` | push 到 main 与 PR 时在 Node 18 / 20 / 22 上跑 `npm test`、类型检查、README 规则表检查。CI 里没有 zerotool-dev，`test/sync.test.js` 的比对用例跳过，不跑 `npm run sync:check`（找不到源文件时它退出 1） |
| `.github/workflows/publish.yml` | 推 `v*` tag 时经 npm trusted publishing 发布（见「发布」） |

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

## 发布

仓库：https://github.com/kassol/secret-redactor（公开）。`package.json` 的 `repository.url` 为 `git+https://github.com/kassol/secret-redactor.git`，`homepage` 为工具页。

### 首发（决策人本机手动执行，agent 不执行 `npm login` / `npm publish`）

npm 的 trusted publisher 在包的 Settings 页配置，包须先存在，所以首发只能本机发布。**首发前 `publish.yml` 不会成功**：推 tag 会在 `npm publish` 一步报认证失败（ENEEDAUTH 或 404）。首发不要推 `v*` tag。本机发布不带 provenance（provenance 只能在受支持的云端 CI 中生成）。

逐条执行：

```bash
cd ~/Workspace/secret-redactor
git switch main && git pull --ff-only     # 与 GitHub 一致，工作区干净
git status --short                        # 应无输出
npm view secret-redactor                  # 应为 404：包名仍未被占用
node -p "require('./package.json').version"   # 确认版本号，首发为 0.1.0
npm ci                                    # 装 devDependencies（typescript），prepublishOnly 要用
npm test                                  # 本机有 ../zerotool-dev，同步比对用例会运行
npm pack --dry-run                        # 应为 7 个文件：LICENSE、README.md、package.json、bin/secret-redactor.js、src/engine.js、src/index.js、src/index.d.ts
npm login                                 # 浏览器完成登录
npm whoami                                # 确认是要拥有这个包的账号
npm profile get "two-factor auth"         # 确认 2FA 已开启（auth-and-writes）
npm publish --access public               # prepublishOnly 先跑测试、类型检查、规则表检查；按提示输入 2FA 验证码
npm view secret-redactor version          # 应为 0.1.0
git tag v0.1.0 && git push origin v0.1.0  # 首发后再推 tag，publish.yml 会失败（版本已存在），可忽略或在 Actions 页取消
```

最后一步可以不做；做的话 tag 与 npm 上的版本对应，但那次 publish workflow 必然失败。

### 首发后配置 trusted publisher

1. npmjs.com → Packages → secret-redactor → Settings → Trusted publishing → Select your publisher：GitHub Actions。
2. 填写：Organization or user `kassol`；Repository `secret-redactor`；Workflow filename `publish.yml`（只填文件名，带 `.yml`，大小写一致）；Environment name 留空。
3. Allowed actions 勾选 **Allow npm publish**。2026-09-03 之后创建的配置默认只允许 `npm stage publish`，不勾选时 workflow 里的 `npm publish` 会被拒。
4. 保存。npm 保存时不校验配置，填错要到发布时才报错。
5. Settings → Publishing access 选 "Require two-factor authentication and disallow tokens"。trusted publishing 走 OIDC，不受此项影响。

### 之后发版

改 `package.json` 的 `version`（与 `AGENTS.md` 变更日志）→ commit → push main → CI 通过 → `git tag vX.Y.Z && git push origin vX.Y.Z`。`publish.yml` 先检查 tag 与 `version` 一致，再跑测试、类型检查与规则表检查，最后 `npm publish --provenance --access public`。

### `publish.yml` 依据

- trusted publishing 要求 npm CLI ≥ 11.5.1、Node ≥ 22.14.0；只支持 GitHub 托管的 runner；workflow 需 `permissions: id-token: write`；设置里填的 workflow 文件名须与 `.github/workflows/` 下的文件名完全一致；`package.json` 的 `repository.url` 须与 GitHub 仓库完全一致。workflow 用 Node 24（自带 npm 11.x，并打印 `npm --version`）。出处：https://docs.npmjs.com/trusted-publishers （2026-10-01 读取，页面最后编辑于 2026-09-30）。
- 经 trusted publishing 从公开仓库发布公开包时，npm 自动生成 provenance，`--provenance` 可不写；保留它不影响结果。首次以公开方式发布需 `--access public`。出处：同上「Automatic provenance generation」，与 https://docs.npmjs.com/generating-provenance-statements （2026-10-01 读取）。
- `setup-node` 设 `package-manager-cache: false`，与官方示例一致（发布构建不用缓存）。

## 变更日志

- 2026-10-01 — 初始化。引擎同步自 zerotool-dev `c37473f`（30 条规则 + 高熵检测）。API：`redact(text, options)`（选项 `categories`、`placeholder`、`maxLength`）、`restore(text, entries)`；CLI：stdin / 文件、`--in-place`、`--json`、`--check`、`--only` / `--disable`、`--placeholder`、`--max-length`。测试由 zerotool-dev `scripts/test-secret-redactor.mjs` 迁移并补 API、CLI、同步、README 规则表与示例测试，共 133 项（Node 18 / 20 / 24 实跑通过）。
- 2026-10-01 — 建公开仓库 kassol/secret-redactor；`package.json` 填真实 `repository` / `bugs`，`homepage` 指向工具页；CI 改为 Node 18 / 20 / 22（测试 + 类型检查 + README 规则表）；新增 `publish.yml`（`v*` tag，trusted publishing）；本文件写入首发清单与 trusted publisher 配置步骤。
