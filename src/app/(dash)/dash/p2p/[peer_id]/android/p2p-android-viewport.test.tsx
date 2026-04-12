import type { PropsWithChildren } from "react";
import { beforeEach, expect, test, vi } from "vitest";
import { page } from "vitest/browser";
import { render } from "vitest-browser-react";
import { P2PAndroidViewportStage } from "./p2p-android-viewport-stage";
import type { AndroidRemoteStatusView } from "./p2p-android-viewport-support";

vi.mock("mtxuilib/mt/DebugValue", () => ({
  OnlyDebug: ({ children }: PropsWithChildren) => <>{children}</>,
}));

beforeEach(() => {
  vi.stubGlobal("matchMedia", (query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    addListener: vi.fn(),
    removeListener: vi.fn(),
    dispatchEvent: vi.fn(),
  }));
});

function renderStage(remoteStatus: AndroidRemoteStatusView, controlsEnabled: boolean) {
  render(
    <P2PAndroidViewportStage
      controlsEnabled={controlsEnabled}
      deviceOpNotice={
        controlsEnabled
          ? null
          : {
              detail: "截图能力暂不可用。",
              title: "截图不可用",
              tone: "warning",
            }
      }
      onBack={vi.fn()}
      onHome={vi.fn()}
      onPerformanceProfileChange={vi.fn()}
      onReconnect={vi.fn()}
      onRecents={vi.fn()}
      onRotate={vi.fn()}
      onScreenshot={vi.fn()}
      onSendText={vi.fn(async () => true)}
      performanceMeta="中档 · 120 ms"
      performanceProfile="medium"
      reconnectEnabled={true}
      remoteCanvas={<canvas data-testid="android-remote-canvas" />}
      remoteStatus={remoteStatus}
      rotateEnabled={controlsEnabled}
      rotateHint={{ detail: "可用", op: "rotate", title: "旋转可用", tone: "success" }}
      screenshotEnabled={controlsEnabled}
      screenshotHint={{ detail: "可用", op: "captureScreenshot", title: "截图可用", tone: "success" }}
      sessionDebugItems={[{ label: "targetAddress", value: "/ip4/127.0.0.1/tcp/1234" }]}
      sessionInfoItems={[{ label: "Peer ID", value: "12D3KooWTest" }]}
      textActionsEnabled={controlsEnabled}
      textInputHint={{ detail: "可用", op: "writeClipboard", title: "文本输入可用", tone: "success" }}
      viewportSize={{ width: 360, height: 720 }}
    />,
  );
}

test("P2PAndroidViewportStage 保留已连接态的核心测试选择器", async () => {
  renderStage(
    {
      detail: "scrcpy 会话已连接，Back / Home / 文本输入会直接通过浏览器侧会话发送。",
      label: "Connected",
      showBusyIndicator: false,
    },
    true,
  );

  await expect.element(page.getByTestId("android-remote-stage")).toBeVisible();
  await expect.element(page.getByTestId("android-remote-canvas")).toBeVisible();
  await expect.element(page.getByTestId("android-home-button")).toBeEnabled();
  await expect.element(page.getByTestId("android-more-button")).toBeVisible();
  await expect.element(page.getByTestId("android-controller-busy")).not.toBeInTheDocument();
});

test("P2PAndroidViewportStage 保留忙碌态提示和禁用导航按钮", async () => {
  renderStage(
    {
      detail: "当前控制会话已被占用",
      label: "Busy",
      showBusyIndicator: true,
    },
    false,
  );

  await expect.element(page.getByTestId("android-controller-busy")).toHaveTextContent("当前控制会话已被占用");
  await expect.element(page.getByTestId("android-device-op-notice")).toHaveTextContent("截图不可用");
  await expect.element(page.getByTestId("android-back-button")).toBeDisabled();
  await expect.element(page.getByTestId("android-home-button")).toBeDisabled();
});
