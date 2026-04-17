# 2026-04-17_gomtmui_explicit_server_url_progress.md

# gomtmui 显式 serverUrl 初始化模型重构进度记录

## 本轮目标

继续沿“前端不应把自身站点当 gomtm server，而应显式选择后端 server URL”这一正确方向推进，并在代码、部署与浏览器实际运行版本三层同时验证。

## 本轮实际完成内容

### 1. 完成 `/dash/p2p` 显式 serverUrl 模型的主体重构

本轮在 `/workspace/gomtmui` 中继续推进，并完成了以下活跃源码收敛：

- `src/app/(dash)/dash/p2p/p2p-bootstrap-storage.ts`
- `src/app/(dash)/dash/p2p/use-live-browser-bootstrap-truth.ts`
- `src/app/(dash)/dash/p2p/use-p2p-session.ts`
- `src/app/(dash)/dash/p2p/page.tsx`

核心变化：

1. `serverUrl` 从“陪衬字段”提升为一等配置
   - 新增 `readStoredBootstrapServerUrl()`
   - 新增 `persistStoredBootstrapServerUrl()`
   - 新增 `clearStoredBootstrapRuntime()`
   - 保留 `bootstrapAddr` 但降为高级覆盖输入

2. `useLiveBrowserBootstrapTruth(...)` 不再猜 origin
   - 不再把 `window.location.origin`、构建期 env 和硬编码 origin 混成候选探测
   - 改为显式接收 `serverUrl`
   - 只请求 `${serverUrl}/.well-known/gomtm-bootstrap`

3. `useP2PSessionState()` 初始化状态机已切到新语义
   - 新增 `needs-server-url`
   - 新增 `fetching-bootstrap-truth`
   - 没有 `serverUrl` 时不再退化为“等待 bootstrap 地址”，而是明确等待后端地址
   - `saveServerUrl()` 会保存 server URL、清理旧 bootstrap runtime，并重新触发 bootstrap truth 拉取链路

4. `/dash/p2p` 网络面板已切成新的主交互
   - 显式展示“后端地址”
   - 显式展示“当前 bootstrap”
   - 主输入框变为：`gomtm server 公网地址，例如 https://gomtm2.yuepa8.com`
   - 主按钮变为：`保存并连接`
   - multiaddr 输入降为高级覆盖项：`高级：手工覆盖浏览器可拨 multiaddr（WebTransport/WSS）`

### 2. 修复了一个真实运行时错误

用户补充提供了前端错误：

```text
[ { "expected": "string", "code": "invalid_type", "path": [ "p2p", "browser", "generation" ], "message": "Invalid input: expected string, received undefined" } ]
```

根因确认：

- `use-live-browser-bootstrap-truth.ts` 中错误地把已经过 `parsePublicBootstrapMetadata(...)` 解析后的 metadata 再次回喂给同一个 parser
- 第二次回喂时字段结构已从 wire shape 变成 normalized shape，导致 `p2p.browser.generation` 丢失

本轮已修复：

- 删除错误的“二次 parsePublicBootstrapMetadata(...)”路径
- 改为直接返回第一次解析后的 `metadata.p2p.browser`

### 3. 本地测试已通过

我运行了以下测试：

```bash
cd /workspace/gomtmui && bun x vitest run \
  'src/app/(dash)/dash/p2p/p2p-bootstrap-storage.test.ts' \
  'src/app/(dash)/dash/p2p/use-live-browser-bootstrap-truth.test.tsx' \
  'src/app/(dash)/dash/p2p/use-p2p-session.test.tsx'
```

结果：

- 3 个 test files 全通过
- 15 个 tests 全通过

### 4. 已确认最新部署与浏览器实际运行版本对齐

本轮先经 GitHub Actions `Deploy` 成功后，再额外手动执行一次：

```bash
cd /workspace/gomtmui && npx wrangler deploy ...
```

实际部署结果：

- custom domain: `gomtmui-dev.yuepa8.com`
- Current Version ID: `7449c42a-d4e3-4add-bd8d-cf185baa24b4`

随后我在浏览器里直接验证 `_next/static/chunks/app/(dash)/dash/p2p/page-*.js`：

- 当前浏览器实际加载的页面 chunk 已变为：
  - `page-713760aa83045ffd.js`
- 该 chunk 已包含：
  - `保存并连接`
- 说明浏览器实际运行版本已切到这轮显式 serverUrl 模型，不再是旧版 p2p 页面产物

## 当前页面行为

在 fresh 登录 `https://gomtmui-dev.yuepa8.com/dash/p2p` 后，页面现在的外显行为已经明显符合新模型：

- 顶部状态默认显示：`等待后端地址`
- 展开网络面板后可见：
  - `后端地址` = `未配置`
  - `当前 BOOTSTRAP` = `未连接`
  - 输入框：`gomtm server 公网地址，例如 https://gomtm2.yuepa8.com`
  - 按钮：`保存并连接`
  - 高级覆盖输入：`高级：手工覆盖浏览器可拨 multiaddr（WebTransport/WSS）`

这说明：

- “前端默认请求自身 `/.well-known/gomtm-bootstrap`”这一错误设计已经被移除
- 页面不再把 gomtmui-dev 自己偷偷当后端 origin
- 首次进入时明确要求用户输入/选择 gomtm server URL

## 进一步验证

我在页面中输入：

```text
https://gomtm2.yuepa8.com
```

点击 `保存并连接` 后，页面行为为：

- `localStorage['gomtm:p2p:bootstrap-server-url'] = 'https://gomtm2.yuepa8.com'`
- 浏览器确实请求：
  - `https://gomtm2.yuepa8.com/.well-known/gomtm-bootstrap`
- 请求状态均为 200

这说明新的 origin 选择模型已经生效：

- 请求目标来自用户选定的 backend server URL
- 不再来自 `gomtmui-dev` 自身 origin

## 当前剩余问题

尽管 origin 选择模型已经修正，但当前完整真机验收仍未完成。

当前剩余症状：

- 用户输入 `https://gomtm2.yuepa8.com` 并点击 `保存并连接` 后
- 网络面板会进入：
  - `连接失败`
- 仍展示 Zod 类错误：

```text
[ { "expected": "string", "code": "invalid_type", "path": [ "p2p", "browser", "generation" ], "message": "Invalid input: expected string, received undefined" } ]
```

这说明还有一处前端运行时仍在消费一份“形状不对的 bootstrap truth 对象”，而且该消费点不在本轮已修掉的 `use-live-browser-bootstrap-truth.ts` 那条路径上，或者浏览器尚有旧执行链残留。当前可以明确的是：

- 页面路由 chunk 已更新
- 新的 `serverUrl` UI 已在运行
- `gomtmui-dev/.well-known/gomtm-bootstrap` 这个错误默认请求模型已被移除
- 当前新的 blocker 已从“错误 origin”收敛为“仍有某处前端逻辑对 bootstrap truth 的 schema 消费不一致”

## 当前结论

本轮已经成功完成了本任务里最重要的设计修正：

1. `/dash/p2p` 不再默认把前端自身站点当 gomtm server
2. 用户必须显式输入/选择 backend server URL
3. 前端只从选定的 `${serverUrl}/.well-known/gomtm-bootstrap` 拉取 bootstrap truth
4. 浏览器实际运行版本已核对为最新部署产物

但完整三端真机验收还没通过，当前剩余 blocker 是：

- 前端某条剩余执行链仍对 bootstrap truth 的 schema 消费不一致，导致在点击 `保存并连接` 后仍报 `p2p.browser.generation` 缺失

## 相关提交与版本

- `/workspace/gomtmui` 本地重构主体提交：`9ace69d` `wip: switch p2p bootstrap to explicit server url model`
- 测试/收尾后远端最新 head：`2203c4d7cc9c75a36b2444273f04f28656e39e75`
- Cloudflare 当前手动部署版本：`7449c42a-d4e3-4add-bd8d-cf185baa24b4`
- 浏览器实际运行 p2p 页面 chunk：`page-713760aa83045ffd.js`

## 本轮关键验证命令

```bash
cd /workspace/gomtmui && bun x vitest run \
  'src/app/(dash)/dash/p2p/p2p-bootstrap-storage.test.ts' \
  'src/app/(dash)/dash/p2p/use-live-browser-bootstrap-truth.test.tsx' \
  'src/app/(dash)/dash/p2p/use-p2p-session.test.tsx'

cd /workspace/gomtmui && npx wrangler deploy \
  --var NEXT_PUBLIC_SUPABASE_URL:... \
  --var NEXT_PUBLIC_SUPABASE_ANON_KEY:... \
  --var NEXT_PUBLIC_SITE_URL:https://gomtmui-dev.yuepa8.com \
  --var NEXT_PUBLIC_BASE_URL:https://gomtmui-dev.yuepa8.com \
  --var BASE_URL:https://gomtmui-dev.yuepa8.com

Browser: fresh 登录 https://gomtmui-dev.yuepa8.com/dash/p2p
Browser: 确认默认状态为“等待后端地址”
Browser: 输入 https://gomtm2.yuepa8.com 并点击“保存并连接”
Browser: 验证实际请求为 https://gomtm2.yuepa8.com/.well-known/gomtm-bootstrap （200）
Browser: 验证 localStorage 已写入 gomtm:p2p:bootstrap-server-url=https://gomtm2.yuepa8.com
Browser: 验证当前实际运行 chunk 为 page-713760aa83045ffd.js
```
