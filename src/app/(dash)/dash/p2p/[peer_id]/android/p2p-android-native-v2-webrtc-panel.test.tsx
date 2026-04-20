// @vitest-environment jsdom

import { cleanup, render, waitFor } from "@testing-library/react";
import { createElement, useState } from "react";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { render as renderBrowser } from "vitest-browser-react";
import { P2PAndroidNativeV2WebRtcPanel } from "./p2p-android-native-v2-webrtc-panel";

const controlRailState = vi.hoisted(() => ({
  lastProps: null as null | {
    onSendText: (text: string) => Promise<boolean>;
    textActionsEnabled: boolean;
  },
}));

const workerControlMocks = vi.hoisted(() => ({
  captureNativeRemoteV2Screenshot: vi.fn(),
  ensureNativeRemoteV2Stream: vi.fn(),
  invokeNativeRemoteV2Key: vi.fn(),
  invokeNativeRemoteV2Swipe: vi.fn(),
  invokeNativeRemoteV2Tap: vi.fn(),
  invokeNativeRemoteV2Text: vi.fn(),
  openNativeRemoteV2VideoStream: vi.fn(),
}));

vi.mock("@/lib/p2p/worker-control", () => ({
  captureNativeRemoteV2Screenshot: workerControlMocks.captureNativeRemoteV2Screenshot,
  ensureNativeRemoteV2Stream: workerControlMocks.ensureNativeRemoteV2Stream,
  invokeNativeRemoteV2Key: workerControlMocks.invokeNativeRemoteV2Key,
  invokeNativeRemoteV2Swipe: workerControlMocks.invokeNativeRemoteV2Swipe,
  invokeNativeRemoteV2Tap: workerControlMocks.invokeNativeRemoteV2Tap,
  invokeNativeRemoteV2Text: workerControlMocks.invokeNativeRemoteV2Text,
  openNativeRemoteV2VideoStream: workerControlMocks.openNativeRemoteV2VideoStream,
}));

vi.mock("./native-android-video-renderer", () => ({
  createNativeAndroidCanvasRenderer: () => ({
    close: vi.fn(async () => undefined),
    renderPacket: vi.fn(async () => undefined),
  }),
}));

vi.mock("./p2p-android-viewport-control-rail", () => ({
  AndroidControlRail: (props: unknown) => {
    controlRailState.lastProps = props as typeof controlRailState.lastProps;
    return createElement("div", { "data-testid": "android-control-rail" });
  },
  AndroidDeviceNavigationBar: () => createElement("div", { "data-testid": "android-device-nav" }),
}));

type HarnessSession = Parameters<typeof P2PAndroidNativeV2WebRtcPanel>[0]["session"];
type HarnessNode = NonNullable<ReturnType<HarnessSession["getCurrentNode"]>>;

function createPendingPackets(): AsyncIterable<{ data: Uint8Array; keyframe: boolean; ptsUs: bigint; type: "data" }> {
  return {
    [Symbol.asyncIterator]() {
      return {
        async next() {
          return await new Promise<IteratorResult<{ data: Uint8Array; keyframe: boolean; ptsUs: bigint; type: "data" }>>(
            () => undefined,
          );
        },
      };
    },
  };
}

function createSession(capability: { reason?: string; state?: string }, node: HarnessNode = {} as HarnessNode): HarnessSession {
  return {
    candidatePairSummary: undefined,
    directEvidenceSummary: undefined,
    getCurrentNode: () => node,
    lastError: undefined,
    lastResult: undefined,
    nativeRemoteV2: {
      capability,
      webrtc: undefined,
    },
    peerId: "12D3KooWPermissionPeer",
    runDirectExperiment: undefined,
    state: undefined,
    targetAddress: "/ip4/156.233.234.137/udp/8443/quic-v1/webtransport/p2p/12D3KooWPermissionPeer",
  } as HarnessSession;
}

function PermissionHarness() {
  const [session, setSession] = useState(() => createSession({ reason: "awaiting_stream_runtime", state: "host_not_ready" }));

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

function NodeReplacementHarness() {
  const [node, setNode] = useState<HarnessNode>(() => ({ id: "node-a" }) as HarnessNode);

  return createElement(
    "div",
    undefined,
    createElement(
      "button",
      {
        onClick: () => {
          setNode(({ id: "node-b" }) as HarnessNode);
        },
        type: "button",
      },
      "replace node",
    ),
    createElement(P2PAndroidNativeV2WebRtcPanel, { session: createSession({ state: "available" }, node) }),
  );
}

function createConnectedStreamMocks() {
  workerControlMocks.ensureNativeRemoteV2Stream.mockResolvedValue({
    channel: {
      height: 1920,
      width: 1080,
    },
    resolved: {
      host: "127.0.0.1",
      kind: "loopback_tcp",
      port: 9200,
    },
    status: "streaming",
  });
  workerControlMocks.openNativeRemoteV2VideoStream.mockResolvedValue({
    close: vi.fn(async () => undefined),
    metadata: {
      height: 1920,
      width: 1080,
    },
    packets: createPendingPackets(),
  });
}

describe("P2PAndroidNativeV2WebRtcPanel", () => {
  beforeEach(() => {
    controlRailState.lastProps = null;
    workerControlMocks.captureNativeRemoteV2Screenshot.mockReset();
    workerControlMocks.ensureNativeRemoteV2Stream.mockReset();
    workerControlMocks.invokeNativeRemoteV2Key.mockReset();
    workerControlMocks.invokeNativeRemoteV2Swipe.mockReset();
    workerControlMocks.invokeNativeRemoteV2Tap.mockReset();
    workerControlMocks.invokeNativeRemoteV2Text.mockReset();
    workerControlMocks.openNativeRemoteV2VideoStream.mockReset();
  });

  afterEach(() => {
    cleanup();
  });

  test("原生远控在录屏权限缺失后保持待授权态，不因能力轮询重置为连接中", async () => {
    workerControlMocks.ensureNativeRemoteV2Stream.mockRejectedValue(
      Object.assign(new Error("screen capture permission is not granted"), {
        code: "SB_PERMISSION_REQUIRED",
      }),
    );

    const rendered = renderBrowser(createElement(PermissionHarness));

    await expect.element(rendered.getByText("待授权")).toBeInTheDocument();
    await expect.element(rendered.getByText("screen_capture_not_granted")).toBeInTheDocument();
    expect(workerControlMocks.ensureNativeRemoteV2Stream).toHaveBeenCalled();

    await rendered.getByRole("button", { name: "mutate capability" }).click();

    await expect.element(rendered.getByText("待授权")).toBeInTheDocument();
    await expect.element(rendered.getByText("screen_capture_not_granted")).toBeInTheDocument();
    expect(workerControlMocks.ensureNativeRemoteV2Stream).toHaveBeenCalled();
    expect(workerControlMocks.openNativeRemoteV2VideoStream).not.toHaveBeenCalled();
  });

  test("连接成功后发送文本会调用 native remote v2 text 命令", async () => {
    createConnectedStreamMocks();
    workerControlMocks.invokeNativeRemoteV2Text.mockResolvedValue(undefined);

    render(createElement(P2PAndroidNativeV2WebRtcPanel, { session: createSession({ state: "available" }) }));

    await waitFor(() => {
      expect(controlRailState.lastProps?.textActionsEnabled).toBe(true);
    });

    const sent = await controlRailState.lastProps?.onSendText("hello native remote");

    expect(sent).toBe(true);
    expect(workerControlMocks.invokeNativeRemoteV2Text).toHaveBeenCalledWith({
      address: "/ip4/156.233.234.137/udp/8443/quic-v1/webtransport/p2p/12D3KooWPermissionPeer",
      node: expect.any(Object),
      peerId: "12D3KooWPermissionPeer",
      text: "hello native remote",
    });
  });

  test("当前 browser node 实例变化后会重新建立 native remote v2 流", async () => {
    const nodeA = { id: "node-a" } as HarnessNode;
    const nodeB = { id: "node-b" } as HarnessNode;
    let nextNode = nodeA;

    workerControlMocks.ensureNativeRemoteV2Stream.mockImplementation(async () => ({
      channel: {
        height: 1920,
        width: 1080,
      },
      resolved: {
        host: "127.0.0.1",
        kind: "loopback_tcp",
        port: 9200,
      },
      status: nextNode === nodeA ? "stream-a" : "stream-b",
    }));
    workerControlMocks.openNativeRemoteV2VideoStream.mockResolvedValue({
      close: vi.fn(async () => undefined),
      metadata: {
        height: 1920,
        width: 1080,
      },
      packets: createPendingPackets(),
    });

    render(createElement(NodeReplacementHarness));

    await waitFor(() => {
      expect(workerControlMocks.ensureNativeRemoteV2Stream).toHaveBeenCalledTimes(1);
    });
    expect(workerControlMocks.ensureNativeRemoteV2Stream).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({ node: nodeA }),
    );

    nextNode = nodeB;
    const rendered = renderBrowser(createElement(NodeReplacementHarness));
    await rendered.getByRole("button", { name: "replace node" }).click();

    await waitFor(() => {
      expect(workerControlMocks.ensureNativeRemoteV2Stream).toHaveBeenCalledTimes(2);
    });
    expect(workerControlMocks.ensureNativeRemoteV2Stream).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({ node: nodeB }),
    );
  });
});
