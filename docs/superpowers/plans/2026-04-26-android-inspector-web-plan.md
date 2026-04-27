# Android Inspector 网页化诊断页实现计划

> **面向 agentic workers：** 必需子技能：使用 superpowers:subagent-driven-development（推荐）或 superpowers:executing-plans，按任务逐项实现这份计划。步骤使用复选框（`- [ ]`）语法进行跟踪。

**目标：** 在 `gomtmui` 的 Dash 中新增一个面向已登记在线 Android 设备的网页内 Inspector/诊断页，支持选中设备后查看屏幕快照、UI hierarchy、元素属性与基础交互，不再依赖人工在 Linux 上启动 `uiautodev`。

**架构：** 以 `/dash/devices/[deviceId]/inspector` 作为页面落点，沿用现有 `devices` 列表作为入口。前端新增 Inspector 页面与视图模型，后端/设备通道新增最小调试 API 契约（截图、层级树、点击、刷新），先做最小可用闭环，再迭代 XPath、高亮与高级动作。

**技术栈：** Next.js App Router、React、TypeScript、`mtxuilib`、现有 `gomtmui` Dash 布局、Browser Mode / Vitest、gomtm 设备通道/Android 自动化底座。

---

## 规划边界与设计原则

- Inspector 应挂在 `设备` 域，不挂在 `P2P` 域。
- 不复制 `uiautodev` 实现；只借鉴其交互布局与诊断能力模型。
- 第一版优先“截图 + hierarchy + 选中元素 + 基础点击 + 刷新”，不要一开始就做全量 XPath、录制回放、脚本生成。
- 前端不直接依赖 adb、不要求本地人工启动额外服务；诊断能力必须通过 gomtm 自己的设备侧/服务侧 API 暴露。
- 页面结构遵循现有 `src/app/(dash)` 组织方式，避免把大量布局/视图模型塞回现有 `devices/page.tsx`。

## 目标文件结构

### 前端页面与组件
- 新建：`/workspace/gomtmui/src/app/(dash)/dash/devices/[deviceId]/page.tsx`
  - 设备详情页入口，承接概览和 Inspector 导航。
- 新建：`/workspace/gomtmui/src/app/(dash)/dash/devices/[deviceId]/inspector/page.tsx`
  - Inspector 页面主入口。
- 新建：`/workspace/gomtmui/src/app/(dash)/dash/devices/[deviceId]/inspector/device-inspector-view.tsx`
  - 纯展示组件，负责三栏布局。
- 新建：`/workspace/gomtmui/src/app/(dash)/dash/devices/[deviceId]/inspector/use-device-inspector-session.ts`
  - 页面级状态组织：设备详情、快照、元素树、选中节点、刷新动作。
- 新建：`/workspace/gomtmui/src/app/(dash)/dash/devices/[deviceId]/inspector/device-inspector-canvas.tsx`
  - 屏幕快照画布、点击坐标换算、叠加框。
- 新建：`/workspace/gomtmui/src/app/(dash)/dash/devices/[deviceId]/inspector/device-inspector-tree.tsx`
  - hierarchy 树浏览与节点选中。
- 新建：`/workspace/gomtmui/src/app/(dash)/dash/devices/[deviceId]/inspector/device-inspector-node-detail.tsx`
  - 节点属性面板。
- 视情况新建：`/workspace/gomtmui/src/app/(dash)/dash/devices/[deviceId]/inspector/device-inspector-actions.tsx`
  - 刷新、点击模式、复制 selector 等动作栏。

### 前端数据/契约层
- 新建：`/workspace/gomtmui/src/lib/devices/device-inspector-contracts.ts`
  - Inspector API 响应类型、Hierarchy 节点模型、截图元数据、tap 请求体。
- 新建：`/workspace/gomtmui/src/lib/devices/device-inspector-api.ts`
  - fetch 封装：`fetchDeviceInspectorSnapshot`、`tapDeviceInspectorNode` 等。
- 可能修改：`/workspace/gomtmui/src/config/navigation.ts`
  - 若需要为设备详情/Inspector 增加显式导航入口或二级路由提示。

### 测试
- 新建：`/workspace/gomtmui/src/lib/devices/device-inspector-contracts.test.ts`
- 新建：`/workspace/gomtmui/src/app/(dash)/dash/devices/[deviceId]/inspector/use-device-inspector-session.test.tsx`
- 新建：`/workspace/gomtmui/src/app/(dash)/dash/devices/[deviceId]/inspector/device-inspector-view.browser.test.tsx`
- 视情况修改：`/workspace/gomtmui/src/app/(dash)/dash/devices/page.tsx` 对应测试（若新增跳转入口）

### 文档/接口对齐（非前端仓内也要同步）
- 需要补充 gomtm / gomtm-android 侧接口设计文档，说明 Inspector 最小 API：
  - `GET /api/devices/:id/inspector/snapshot`
  - `POST /api/devices/:id/inspector/tap`
  - 后续可扩：`POST /highlight`、`POST /input`、`POST /query`
- 如果当前后端尚无此 API，本计划的前端部分应先以 mock/契约驱动落地，不假装后端已存在。

---

### 任务 1：为 Inspector 定义最小产品边界与 API 契约

**文件：**
- 新建：`/workspace/gomtmui/src/lib/devices/device-inspector-contracts.ts`
- 新建：`/workspace/gomtmui/src/lib/devices/device-inspector-contracts.test.ts`
- 参考：`/workspace/gomtmui/src/lib/p2p/discovery-contracts.ts`
- 参考：`/workspace/gomtmui/src/lib/p2p/server-peer-directory-api.ts`

- [ ] **步骤 1：编写失败测试，约束 Inspector 契约的最小 shape**

```ts
import { describe, expect, it } from "vitest";
import { parseDeviceInspectorSnapshot } from "./device-inspector-contracts";

describe("parseDeviceInspectorSnapshot", () => {
  it("normalizes screenshot, display info and hierarchy tree", () => {
    const snapshot = parseDeviceInspectorSnapshot({
      screenshot: {
        url: "https://example.com/frame.jpg",
        width: 1080,
        height: 2400,
      },
      hierarchy: {
        root: {
          id: "root",
          className: "android.widget.FrameLayout",
          bounds: [0, 0, 1080, 2400],
          children: [],
        },
      },
    });

    expect(snapshot.screenshot.url).toContain("frame.jpg");
    expect(snapshot.hierarchy.root.id).toBe("root");
  });
});
```

- [ ] **步骤 2：运行测试，确认它失败**

运行：
```bash
bun vitest /workspace/gomtmui/src/lib/devices/device-inspector-contracts.test.ts
```
预期：以模块或符号不存在失败。

- [ ] **步骤 3：编写最小实现，统一设备 Inspector 的前端契约**

需要定义：
- `DeviceInspectorBounds`
- `DeviceInspectorNode`
- `DeviceInspectorHierarchy`
- `DeviceInspectorScreenshot`
- `DeviceInspectorSnapshot`
- `parseDeviceInspectorSnapshot(raw)`

要求：
- 不要把后端原始 payload 直接泄漏到页面。
- `bounds`、`text`、`resourceId`、`contentDesc`、`clickable`、`enabled` 等字段收敛成稳定 shape。
- 对缺失字段给最小安全默认值。

- [ ] **步骤 4：运行测试，确认它通过**

运行：
```bash
bun vitest /workspace/gomtmui/src/lib/devices/device-inspector-contracts.test.ts
```
预期：PASS。

- [ ] **步骤 5：提交**

```bash
git add src/lib/devices/device-inspector-contracts.ts src/lib/devices/device-inspector-contracts.test.ts
git commit -m "feat: add device inspector contracts"
```

---

### 任务 2：新增 Inspector API 封装，隔离 fetch 与错误处理

**文件：**
- 新建：`/workspace/gomtmui/src/lib/devices/device-inspector-api.ts`
- 测试：可并入 `device-inspector-contracts.test.ts` 或新增 `device-inspector-api.test.ts`
- 参考：`/workspace/gomtmui/src/lib/p2p/server-peer-directory-api.ts`

- [ ] **步骤 1：编写失败测试，约束快照请求与 tap 请求行为**

```ts
it("fetches inspector snapshot and parses payload", async () => {
  global.fetch = vi.fn().mockResolvedValue(
    new Response(JSON.stringify({ screenshot: { url: "https://example.com/1.jpg", width: 100, height: 200 }, hierarchy: { root: { id: "root", bounds: [0,0,100,200], children: [] } } }), { status: 200 })
  );

  const snapshot = await fetchDeviceInspectorSnapshot("https://gomtm.example.com", "device-1");
  expect(snapshot.hierarchy.root.id).toBe("root");
});
```

- [ ] **步骤 2：运行测试，确认它失败**

运行：
```bash
bun vitest /workspace/gomtmui/src/lib/devices/device-inspector-api.test.ts
```
预期：`fetchDeviceInspectorSnapshot` 未定义或导入失败。

- [ ] **步骤 3：实现最小 API 封装**

需要至少提供：
- `fetchDeviceInspectorSnapshot(serverUrl: string, deviceId: string)`
- `postDeviceInspectorTap(serverUrl: string, deviceId: string, body: { x: number; y: number })`

要求：
- 统一裁剪 `serverUrl`。
- 报错信息向页面返回用户可读文案。
- `snapshot` 请求默认 `cache: "no-store"`。
- 不把 fetch 细节散落到页面组件。

- [ ] **步骤 4：运行测试，确认它通过**

运行：
```bash
bun vitest /workspace/gomtmui/src/lib/devices/device-inspector-api.test.ts
```
预期：PASS。

- [ ] **步骤 5：提交**

```bash
git add src/lib/devices/device-inspector-api.ts src/lib/devices/device-inspector-api.test.ts
git commit -m "feat: add device inspector api client"
```

---

### 任务 3：补设备详情路由与 Inspector 页面落点

**文件：**
- 新建：`/workspace/gomtmui/src/app/(dash)/dash/devices/[deviceId]/page.tsx`
- 新建：`/workspace/gomtmui/src/app/(dash)/dash/devices/[deviceId]/inspector/page.tsx`
- 修改：`/workspace/gomtmui/src/app/(dash)/dash/devices/page.tsx`

- [ ] **步骤 1：编写失败测试，验证设备列表存在进入 Inspector 的入口**

```tsx
it("renders inspector entry for each device row", async () => {
  render(<DevicesPage ...mockedData />);
  expect(screen.getByRole("link", { name: /诊断/i })).toBeTruthy();
});
```

- [ ] **步骤 2：运行测试，确认它失败**

运行：
```bash
bun vitest /workspace/gomtmui/src/app/(dash)/dash/devices/*.test.tsx
```
预期：找不到“诊断”入口。

- [ ] **步骤 3：实现设备详情与 Inspector 路由骨架**

要求：
- 在设备列表页为每行增加“详情”或“诊断”链接。
- `devices/[deviceId]/page.tsx` 先做轻量详情页，不一次塞满复杂逻辑。
- `devices/[deviceId]/inspector/page.tsx` 只负责取参并渲染 Inspector 容器。
- 使用现有 Dash layout / headers / content，不新造一套壳。

- [ ] **步骤 4：运行测试，确认它通过**

运行：
```bash
bun vitest /workspace/gomtmui/src/app/(dash)/dash/devices
```
预期：PASS。

- [ ] **步骤 5：提交**

```bash
git add src/app/(dash)/dash/devices/page.tsx src/app/(dash)/dash/devices/[deviceId]/page.tsx src/app/(dash)/dash/devices/[deviceId]/inspector/page.tsx
git commit -m "feat: add device detail and inspector routes"
```

---

### 任务 4：实现 Inspector 页面级 session hook，组织设备、快照、选中节点与刷新动作

**文件：**
- 新建：`/workspace/gomtmui/src/app/(dash)/dash/devices/[deviceId]/inspector/use-device-inspector-session.ts`
- 新建：`/workspace/gomtmui/src/app/(dash)/dash/devices/[deviceId]/inspector/use-device-inspector-session.test.tsx`
- 参考：`/workspace/gomtmui/src/app/(dash)/dash/p2p/runtime/use-server-shell-runtime.ts`

- [ ] **步骤 1：编写失败测试，约束 session hook 的状态流**

```tsx
it("loads snapshot and exposes selected node state", async () => {
  const { result } = renderHook(() => useDeviceInspectorSession({ deviceId: "device-1", serverUrl: "https://gomtm.example.com" }));
  await waitFor(() => expect(result.current.status).toBe("ready"));
  expect(result.current.snapshot?.hierarchy.root.id).toBe("root");
  result.current.selectNode("root");
  expect(result.current.selectedNode?.id).toBe("root");
});
```

- [ ] **步骤 2：运行测试，确认它失败**

运行：
```bash
bun vitest /workspace/gomtmui/src/app/(dash)/dash/devices/[deviceId]/inspector/use-device-inspector-session.test.tsx
```
预期：hook 未定义。

- [ ] **步骤 3：实现最小 session hook**

状态至少包含：
- `status: loading | ready | error | refreshing`
- `snapshot`
- `selectedNodeId`
- `selectedNode`
- `refresh()`
- `selectNode(id)`
- `tapAt(x, y)`

要求：
- 不要把 fetch 逻辑直接写进 JSX。
- 不要做无价值 wrapper；hook 只承载页面级状态机与动作。
- 后端未接好时，错误信息应能明确显示“Inspector API 不可用”。

- [ ] **步骤 4：运行测试，确认它通过**

运行：
```bash
bun vitest /workspace/gomtmui/src/app/(dash)/dash/devices/[deviceId]/inspector/use-device-inspector-session.test.tsx
```
预期：PASS。

- [ ] **步骤 5：提交**

```bash
git add src/app/(dash)/dash/devices/[deviceId]/inspector/use-device-inspector-session.ts src/app/(dash)/dash/devices/[deviceId]/inspector/use-device-inspector-session.test.tsx
git commit -m "feat: add device inspector session hook"
```

---

### 任务 5：实现 Inspector 主视图布局（三栏/两栏），对齐 uiautodev 的核心交互模型

**文件：**
- 新建：`/workspace/gomtmui/src/app/(dash)/dash/devices/[deviceId]/inspector/device-inspector-view.tsx`
- 新建：`/workspace/gomtmui/src/app/(dash)/dash/devices/[deviceId]/inspector/device-inspector-canvas.tsx`
- 新建：`/workspace/gomtmui/src/app/(dash)/dash/devices/[deviceId]/inspector/device-inspector-tree.tsx`
- 新建：`/workspace/gomtmui/src/app/(dash)/dash/devices/[deviceId]/inspector/device-inspector-node-detail.tsx`
- 新建：`/workspace/gomtmui/src/app/(dash)/dash/devices/[deviceId]/inspector/device-inspector-view.browser.test.tsx`

- [ ] **步骤 1：编写 Browser Mode 失败测试，验证主界面最小可见元素**

```tsx
test("renders screenshot, hierarchy panel and node detail", async () => {
  render(<DeviceInspectorView session={mockSession} />);
  await expect.element(screen.getByText("界面层级")).toBeVisible();
  await expect.element(screen.getByText("节点属性")).toBeVisible();
  await expect.element(screen.getByAltText("设备屏幕快照")).toBeVisible();
});
```

- [ ] **步骤 2：运行测试，确认它失败**

运行：
```bash
bun vitest --browser /workspace/gomtmui/src/app/(dash)/dash/devices/[deviceId]/inspector/device-inspector-view.browser.test.tsx
```
预期：组件不存在或关键区块未渲染。

- [ ] **步骤 3：实现最小三栏视图**

布局建议：
- 顶部：设备标题、连接状态、刷新按钮
- 左侧：Hierarchy Tree
- 中间：Screenshot Canvas + overlay
- 右侧：Node Detail

要求：
- 中间画布点击后，能把坐标回传给 session。
- 左侧点树节点后，右侧属性更新。
- 先做静态高亮框，不先做复杂缩放/拖拽编辑器。
- 复用 `mtxuilib` 基础组件，不自造样式体系。

- [ ] **步骤 4：运行 Browser Mode 测试，确认它通过**

运行：
```bash
bun vitest --browser /workspace/gomtmui/src/app/(dash)/dash/devices/[deviceId]/inspector/device-inspector-view.browser.test.tsx
```
预期：PASS。

- [ ] **步骤 5：提交**

```bash
git add src/app/(dash)/dash/devices/[deviceId]/inspector/device-inspector-view.tsx src/app/(dash)/dash/devices/[deviceId]/inspector/device-inspector-canvas.tsx src/app/(dash)/dash/devices/[deviceId]/inspector/device-inspector-tree.tsx src/app/(dash)/dash/devices/[deviceId]/inspector/device-inspector-node-detail.tsx src/app/(dash)/dash/devices/[deviceId]/inspector/device-inspector-view.browser.test.tsx
git commit -m "feat: add device inspector view"
```

---

### 任务 6：打通“刷新快照 + 点击屏幕”最小可用闭环

**文件：**
- 修改：`/workspace/gomtmui/src/app/(dash)/dash/devices/[deviceId]/inspector/use-device-inspector-session.ts`
- 修改：`/workspace/gomtmui/src/app/(dash)/dash/devices/[deviceId]/inspector/device-inspector-canvas.tsx`
- 测试：更新 session/browser tests

- [ ] **步骤 1：编写失败测试，验证点击屏幕后会调用 tap API 并刷新快照**

```tsx
it("taps selected point and refreshes snapshot", async () => {
  const session = createMockSession();
  render(<DeviceInspectorCanvas session={session} />);
  await user.click(screen.getByAltText("设备屏幕快照"));
  expect(mockTapApi).toHaveBeenCalled();
  expect(mockRefresh).toHaveBeenCalled();
});
```

- [ ] **步骤 2：运行测试，确认它失败**

运行：
```bash
bun vitest /workspace/gomtmui/src/app/(dash)/dash/devices/[deviceId]/inspector
```
预期：tap / refresh 断言失败。

- [ ] **步骤 3：实现最小交互闭环**

要求：
- 点击屏幕坐标调用 `postDeviceInspectorTap(...)`
- tap 成功后自动 `refresh()`
- 加入最小 loading/disabled 态，避免重复提交
- 出错时在页面局部显示错误，不拖垮整个页面

- [ ] **步骤 4：运行测试，确认它通过**

运行：
```bash
bun vitest /workspace/gomtmui/src/app/(dash)/dash/devices/[deviceId]/inspector
```
预期：PASS。

- [ ] **步骤 5：提交**

```bash
git add src/app/(dash)/dash/devices/[deviceId]/inspector/use-device-inspector-session.ts src/app/(dash)/dash/devices/[deviceId]/inspector/device-inspector-canvas.tsx
git commit -m "feat: wire inspector tap and refresh flow"
```

---

### 任务 7：补充空状态、错误状态和后端未实现提示，确保第一版可以安全上线

**文件：**
- 修改：`/workspace/gomtmui/src/app/(dash)/dash/devices/[deviceId]/inspector/device-inspector-view.tsx`
- 修改：`/workspace/gomtmui/src/app/(dash)/dash/devices/[deviceId]/inspector/page.tsx`
- 测试：更新 Browser Mode 测试

- [ ] **步骤 1：编写失败测试，验证 API 不可用时有明确提示**

```tsx
test("renders unavailable state when inspector api is not ready", async () => {
  render(<DeviceInspectorView session={{ ...mockSession, status: "error", errorMessage: "Inspector API 不可用" }} />);
  await expect.element(screen.getByText("Inspector API 不可用")).toBeVisible();
});
```

- [ ] **步骤 2：运行测试，确认它失败**

运行：
```bash
bun vitest --browser /workspace/gomtmui/src/app/(dash)/dash/devices/[deviceId]/inspector/device-inspector-view.browser.test.tsx
```
预期：错误态文案不存在。

- [ ] **步骤 3：实现空/错/无能力态**

至少覆盖：
- 设备不存在
- 设备离线
- Inspector API 未实现
- snapshot 返回空 hierarchy
- tap 执行失败

要求：
- 文案直接说明当前阻塞点。
- 不要假装设备支持 inspector。
- 为未来接入 XPath / highlight 预留 disabled action 区即可，不先实现假按钮逻辑。

- [ ] **步骤 4：运行测试，确认它通过**

运行：
```bash
bun vitest --browser /workspace/gomtmui/src/app/(dash)/dash/devices/[deviceId]/inspector/device-inspector-view.browser.test.tsx
```
预期：PASS。

- [ ] **步骤 5：提交**

```bash
git add src/app/(dash)/dash/devices/[deviceId]/inspector/device-inspector-view.tsx src/app/(dash)/dash/devices/[deviceId]/inspector/page.tsx
git commit -m "feat: add inspector empty and error states"
```

---

### 任务 8：做最小整体验证并记录后端配套缺口

**文件：**
- 修改：必要的测试文件
- 可选新增：`/workspace/gomtmui/docs/superpowers/plans/implementation-notes/android-inspector-api-gap.md`（若仓内已有 notes 习惯）

- [ ] **步骤 1：运行前端最小验证**

运行：
```bash
cd /workspace/gomtmui && bun run check
```
预期：typecheck 通过。

- [ ] **步骤 2：运行定向测试**

运行：
```bash
cd /workspace/gomtmui && bun vitest src/lib/devices/device-inspector-contracts.test.ts
cd /workspace/gomtmui && bun vitest src/app/(dash)/dash/devices/[deviceId]/inspector/use-device-inspector-session.test.tsx
cd /workspace/gomtmui && bun vitest --browser src/app/(dash)/dash/devices/[deviceId]/inspector/device-inspector-view.browser.test.tsx
```
预期：PASS。

- [ ] **步骤 3：如需生产构建验证，补站点 URL 后执行**

运行：
```bash
cd /workspace/gomtmui && NEXT_PUBLIC_SITE_URL=http://localhost:3000 bun run build
cd /workspace/gomtmui && NEXT_PUBLIC_SITE_URL=http://localhost:3000 bun run build:worker
```
预期：构建通过。

- [ ] **步骤 4：记录未完成功能与后端依赖，不把 TODO 藏在代码里**

需要明确记录：
- 设备侧尚需实现 screenshot / hierarchy / tap API
- 后续迭代项：XPath、元素高亮、输入、滑动、录制回放、脚本导出
- 本轮只交付最小可用 Inspector，不承诺完整 `uiautodev` parity

- [ ] **步骤 5：提交**

```bash
git add .
git commit -m "feat: add first web-based android inspector"
```

---

## 实施顺序建议

1. 先做契约与 API client（任务 1-2）
2. 再落设备详情与 Inspector 路由（任务 3）
3. 再做页面级 session hook（任务 4）
4. 最后做 UI 视图与交互闭环（任务 5-7）
5. 用任务 8 做整体验证与缺口记录

## 本计划刻意不做的事

- 不直接复制 `uiautodev` 静态资源或前端代码
- 不把 Inspector 挂到 `/dash/p2p` 主页面里
- 不第一版就做复杂 XPath 编辑器、动作录制、代码生成
- 不通过人工 adb / CLI 启动调试服务作为正式产品路径

## 执行注意事项

- 实际改动任何现有 symbol 前，必须先跑 GitNexus impact 分析并向用户报告 blast radius。
- 若某些设备详情/导航现有 symbol 的 impact 为 HIGH/CRITICAL，先停下来汇报，不要继续硬改。
- 页面实现优先小文件、单职责，不把 Canvas、Tree、Detail、Session 都堆回一个 page 文件。
- 若后端当前尚无 Inspector API，前端先按契约开发，页面错误态要诚实暴露“后端未就绪”，不要伪造成功体验。
