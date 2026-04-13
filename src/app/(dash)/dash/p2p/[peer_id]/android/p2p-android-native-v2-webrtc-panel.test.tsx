import { createElement, useState } from "react";
import { expect, test, vi } from "vitest";
import { page } from "vitest/browser";
import { render } from "vitest-browser-react";
import { P2PAndroidNativeV2WebRtcPanel } from "./p2p-android-native-v2-webrtc-panel";

const ensureNativeRemoteV2Stream = vi.fn();
const openNativeRemoteV2VideoStream = vi.fn();

vi.mock("@/lib/p2p/worker-control", () => ({
  ensureNativeRemoteV2Stream,
  invokeNativeRemoteV2Key: vi.fn(),
  invokeNativeRemoteV2Tap: vi.fn(),
  openNativeRemoteV2VideoStream,
}));

vi.mock("./native-android-video-renderer", () => ({
  createNativeAndroidCanvasRenderer: () => ({
    close: vi.fn(async () => undefined),
    renderPacket: vi.fn(async () => undefined),
  }),
}));

vi.mock("./p2p-android-viewport-control-rail", () => ({
  AndroidControlRail: () => createElement("div", { "data-testid": "android-control-rail" }),
  AndroidDeviceNavigationBar: () => createElement("div", { "data-testid": "android-device-nav" }),
}));

type HarnessSession = Parameters<typeof P2PAndroidNativeV2WebRtcPanel>[0]["session"];

function createSession(capability: { reason?: string; state?: string }): HarnessSession {
  return {
    candidatePairSummary: undefined,
    directEvidenceSummary: undefined,
    getCurrentNode: () => ({}) as NonNullable<HarnessSession["getCurrentNode"]>,
    lastError: undefined,
    lastResult: undefined,
    nativeRemoteV2: {
      capability,
      sessionId: undefined,
      sessionLastError: undefined,
      sessionState: undefined,
      sessionTopology: undefined,
      webrtc: undefined,
    },
    peerId: "12D3KooWPermissionPeer",
    runDirectExperiment: undefined,
    state: undefined,
    targetAddress: "/ip4/156.233.234.137/udp/8443/quic-v1/webtransport/p2p/12D3KooWPermissionPeer",
  } as HarnessSession;
}

function PermissionHarness() {
  const [session, setSession] = useState(() =>
    createSession({ reason: "awaiting_stream_runtime", state: "host_not_ready" }),
  );

  return createElement(
    "div",
    undefined,
    createElement(
      "button",
      {
        onClick: () => {
          setSession(createSession({ reason: "fresh_capability_ping", state: "host_not_ready" }));
        },
        type: "button",
      },
      "mutate capability",
    ),
    createElement(P2PAndroidNativeV2WebRtcPanel, { session }),
  );
}

test("原生远控在录屏权限缺失后保持待授权态，不因能力轮询重置为连接中", async () => {
  ensureNativeRemoteV2Stream.mockRejectedValue(
    Object.assign(new Error("screen capture permission is not granted"), {
      code: "SB_PERMISSION_REQUIRED",
    }),
  );
  openNativeRemoteV2VideoStream.mockReset();

  render(createElement(PermissionHarness));

  await expect.element(page.getByText("待授权")).toBeVisible();
  await expect.element(page.getByText("screen_capture_not_granted")).toBeVisible();
  expect(ensureNativeRemoteV2Stream).toHaveBeenCalledTimes(1);

  await page.getByText("mutate capability").click();

  await expect.element(page.getByText("待授权")).toBeVisible();
  await expect.element(page.getByText("screen_capture_not_granted")).toBeVisible();
  expect(ensureNativeRemoteV2Stream).toHaveBeenCalledTimes(1);
  expect(openNativeRemoteV2VideoStream).not.toHaveBeenCalled();
});
