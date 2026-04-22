// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { useAndroidHostRuntime } from "./use-android-host-runtime";

function installBridge(state: {
  connectionConfig: unknown;
  hostInfo: unknown;
  peerCapabilities?: Record<string, unknown>;
  peers: unknown;
  runtimeSnapshot: unknown;
}) {
  let currentState = state;

  const bridge = {
    getConnectionConfig: () => JSON.stringify(currentState.connectionConfig),
    getHostInfo: () => JSON.stringify(currentState.hostInfo),
    getPeerCapabilities: (peerId: string) =>
      JSON.stringify(
        currentState.peerCapabilities?.[peerId] ?? {
          capabilities: [],
          node: { peerId },
        },
      ),
    getRuntimeSnapshot: () => JSON.stringify(currentState.runtimeSnapshot),
    listDiscoveredPeers: () => JSON.stringify(currentState.peers),
    saveConnectionConfig: (payloadJson: string) => {
      const payload = JSON.parse(payloadJson) as { connectionAddress?: string; connection?: string; value?: string };
      const connection = payload.connectionAddress ?? payload.connection ?? payload.value ?? "";
      currentState = {
        ...currentState,
        connectionConfig: {
          connectionAddress: connection,
        },
      };
      return JSON.stringify({ ok: true, connectionAddress: connection });
    },
  };

  (window as Window & { GomtmHostBridge?: unknown }).GomtmHostBridge = bridge;

  return {
    bridge,
    setState(nextState: typeof state) {
      currentState = nextState;
    },
  };
}

function Probe() {
  const runtime = useAndroidHostRuntime();

  return (
    <>
      <div data-testid="server-url">{runtime.serverUrl}</div>
      <div data-testid="server-url-input">{runtime.serverUrlInput}</div>
      <div data-testid="status">{runtime.status}</div>
      <div data-testid="peer-count">{runtime.peers.length}</div>
      <button
        onClick={() => {
          runtime.setServerUrlInput("https://draft.example.com");
        }}
        type="button"
      >
        draft
      </button>
      <button
        onClick={() => {
          void runtime.saveConnection("https://next.example.com");
        }}
        type="button"
      >
        save
      </button>
    </>
  );
}

describe("useAndroidHostRuntime", () => {
  afterEach(() => {
    cleanup();
    vi.useRealTimers();
    delete (window as Window & { GomtmHostBridge?: unknown }).GomtmHostBridge;
  });

  it("rehydrates after saveConnection updates the host snapshot", async () => {
    installBridge({
      connectionConfig: {
        connectionAddress: "https://initial.example.com",
      },
      hostInfo: { hostKind: "android-host" },
      peers: [],
      runtimeSnapshot: {
        activeConnectionAddr: "/dns4/bootstrap.example.com/tcp/443/tls/ws/p2p/12D3KooWBootstrap",
        currentNode: { peerId: "android-peer" },
        status: "discovering",
      },
    });

    render(<Probe />);

    await waitFor(() => {
      expect(screen.getByTestId("server-url").textContent).toBe("https://initial.example.com");
    });

    fireEvent.click(screen.getByRole("button", { name: "save" }));

    await waitFor(() => {
      expect(screen.getByTestId("server-url").textContent).toBe("https://next.example.com");
    });
  });

  it("rehydrates when the window regains focus after host state changes", async () => {
    const bridge = installBridge({
      connectionConfig: {
        connectionAddress: "https://initial.example.com",
      },
      hostInfo: { hostKind: "android-host" },
      peers: [],
      runtimeSnapshot: {
        activeConnectionAddr: "/dns4/bootstrap.example.com/tcp/443/tls/ws/p2p/12D3KooWBootstrap",
        currentNode: { peerId: "android-peer" },
        status: "discovering",
      },
    });

    render(<Probe />);

    await waitFor(() => {
      expect(screen.getByTestId("server-url").textContent).toBe("https://initial.example.com");
    });

    bridge.setState({
      connectionConfig: {
        connectionAddress: "https://focused.example.com",
      },
      hostInfo: { hostKind: "android-host" },
      peers: [],
      runtimeSnapshot: {
        activeConnectionAddr: "/dns4/bootstrap.example.com/tcp/443/tls/ws/p2p/12D3KooWBootstrap",
        currentNode: { peerId: "android-peer" },
        status: "discovering",
      },
    });

    fireEvent(window, new Event("focus"));

    await waitFor(() => {
      expect(screen.getByTestId("server-url").textContent).toBe("https://focused.example.com");
    });
  });

  it("normalizes shared capability payloads from getPeerCapabilities", async () => {
    let runtimeRef: ReturnType<typeof useAndroidHostRuntime> | null = null;

    installBridge({
      connectionConfig: {
        connectionAddress: "https://initial.example.com",
      },
      hostInfo: { hostKind: "android-host" },
      peerCapabilities: {
        "12D3KooWPeer": {
          capabilities: [
            {
              name: "android.native_remote_v2_webrtc",
              reason: "ready",
              state: "available",
            },
          ],
          node: {
            peerId: "12D3KooWPeer",
            platform: "android",
          },
        },
      },
      peers: [],
      runtimeSnapshot: {
        activeConnectionAddr: "/dns4/bootstrap.example.com/tcp/443/tls/ws/p2p/12D3KooWBootstrap",
        currentNode: { peerId: "android-peer" },
        status: "discovering",
      },
    });

    function CapabilityProbe() {
      runtimeRef = useAndroidHostRuntime();
      return <div data-testid="status">{runtimeRef.status}</div>;
    }

    render(<CapabilityProbe />);

    await waitFor(() => {
      expect(screen.getByTestId("status").textContent).toBe("discovering");
    });

    const capabilities = await runtimeRef?.readPeerCapabilities("12D3KooWPeer");
    expect(capabilities).toEqual([
      {
        name: "android.native_remote_v2_webrtc",
        reason: "ready",
        state: "available",
      },
    ]);
  });

  it("replaces stale available capability truth with empty bridge results after forceRefresh", async () => {
    let runtimeRef: ReturnType<typeof useAndroidHostRuntime> | null = null;
    const bridge = installBridge({
      connectionConfig: {
        connectionAddress: "https://initial.example.com",
      },
      hostInfo: { hostKind: "android-host" },
      peerCapabilities: {
        "12D3KooWPeer": {
          capabilities: [
            {
              name: "android.native_remote_v2_webrtc",
              reason: "ready",
              state: "available",
            },
          ],
          node: {
            peerId: "12D3KooWPeer",
          },
        },
      },
      peers: [],
      runtimeSnapshot: {
        activeConnectionAddr: "/dns4/bootstrap.example.com/tcp/443/tls/ws/p2p/12D3KooWBootstrap",
        currentNode: { peerId: "android-peer" },
        status: "discovering",
      },
    });

    function CapabilityProbe() {
      runtimeRef = useAndroidHostRuntime();
      return <div data-testid="status">{runtimeRef.status}</div>;
    }

    render(<CapabilityProbe />);

    await waitFor(() => {
      expect(screen.getByTestId("status").textContent).toBe("discovering");
    });

    expect(await runtimeRef?.readPeerCapabilities("12D3KooWPeer")).toEqual([
      {
        name: "android.native_remote_v2_webrtc",
        reason: "ready",
        state: "available",
      },
    ]);

    bridge.setState({
      connectionConfig: {
        connectionAddress: "https://initial.example.com",
      },
      hostInfo: { hostKind: "android-host" },
      peerCapabilities: {
        "12D3KooWPeer": {
          capabilities: [],
          node: {
            peerId: "12D3KooWPeer",
          },
        },
      },
      peers: [],
      runtimeSnapshot: {
        activeConnectionAddr: "/dns4/bootstrap.example.com/tcp/443/tls/ws/p2p/12D3KooWBootstrap",
        currentNode: { peerId: "android-peer" },
        status: "discovering",
      },
    });

    expect(await runtimeRef?.readPeerCapabilities("12D3KooWPeer", { forceRefresh: true })).toEqual([]);
    expect(runtimeRef?.getResolvedPeerCapabilities?.("12D3KooWPeer")).toEqual([]);
    expect(runtimeRef?.getResolvedPeerTruth("12D3KooWPeer")).toBeNull();
    expect(await runtimeRef?.readPeerCapabilities("12D3KooWPeer")).toEqual([]);
  });

  it("clears cached capability data after host runtime identity changes", async () => {
    let runtimeRef: ReturnType<typeof useAndroidHostRuntime> | null = null;
    const bridge = installBridge({
      connectionConfig: {
        connectionAddress: "https://initial.example.com",
      },
      hostInfo: { hostKind: "android-host" },
      peerCapabilities: {
        "12D3KooWPeer": {
          capabilities: [
            {
              name: "android.native_remote_v2_webrtc",
              reason: "ready",
              state: "available",
            },
          ],
          node: {
            peerId: "12D3KooWPeer",
          },
        },
      },
      peers: [],
      runtimeSnapshot: {
        activeConnectionAddr: "/dns4/bootstrap-a.example.com/tcp/443/tls/ws/p2p/12D3KooWA",
        currentNode: { peerId: "android-peer-a" },
        status: "discovering",
      },
    });

    function CapabilityProbe() {
      runtimeRef = useAndroidHostRuntime();
      return <div data-testid="status">{runtimeRef.status}</div>;
    }

    render(<CapabilityProbe />);

    await waitFor(() => {
      expect(screen.getByTestId("status").textContent).toBe("discovering");
    });

    expect(await runtimeRef?.readPeerCapabilities("12D3KooWPeer")).toEqual([
      {
        name: "android.native_remote_v2_webrtc",
        reason: "ready",
        state: "available",
      },
    ]);
    expect(runtimeRef?.getResolvedPeerCapabilities?.("12D3KooWPeer")).toEqual([
      {
        name: "android.native_remote_v2_webrtc",
        reason: "ready",
        state: "available",
      },
    ]);

    bridge.setState({
      connectionConfig: {
        connectionAddress: "https://switched.example.com",
      },
      hostInfo: { hostKind: "android-host" },
      peerCapabilities: {
        "12D3KooWPeer": {
          capabilities: [],
          node: {
            peerId: "12D3KooWPeer",
          },
        },
      },
      peers: [],
      runtimeSnapshot: {
        activeConnectionAddr: "/dns4/bootstrap-b.example.com/tcp/443/tls/ws/p2p/12D3KooWB",
        currentNode: { peerId: "android-peer-b" },
        status: "discovering",
      },
    });

    fireEvent(window, new Event("focus"));

    await waitFor(() => {
      expect(runtimeRef?.currentNode?.peerId).toBe("android-peer-b");
    });

    expect(runtimeRef?.getResolvedPeerCapabilities?.("12D3KooWPeer")).toBeNull();
    expect(runtimeRef?.getResolvedPeerTruth("12D3KooWPeer")).toBeNull();
  });

  it("polls while the WebView stays visible", async () => {
    vi.useFakeTimers({ toFake: ["setInterval", "clearInterval"] });

    const bridge = installBridge({
      connectionConfig: {
        connectionAddress: "https://initial.example.com",
      },
      hostInfo: { hostKind: "android-host" },
      peers: [],
      runtimeSnapshot: {
        activeConnectionAddr: "/dns4/bootstrap.example.com/tcp/443/tls/ws/p2p/12D3KooWBootstrap",
        currentNode: { peerId: "android-peer" },
        status: "discovering",
      },
    });

    render(<Probe />);

    await waitFor(() => {
      expect(screen.getByTestId("peer-count").textContent).toBe("0");
    });

    bridge.setState({
      connectionConfig: {
        connectionAddress: "https://initial.example.com",
      },
      hostInfo: { hostKind: "android-host" },
      peers: [{ peerId: "12D3KooWPeer", multiaddrs: [], lastDiscoveredAt: "2026-04-22T00:00:00.000Z" }],
      runtimeSnapshot: {
        activeConnectionAddr: "/dns4/bootstrap.example.com/tcp/443/tls/ws/p2p/12D3KooWBootstrap",
        currentNode: { peerId: "android-peer" },
        status: "peer_candidates_ready",
      },
    });

    await vi.advanceTimersByTimeAsync(5_000);

    await waitFor(() => {
      expect(screen.getByTestId("peer-count").textContent).toBe("1");
    });
  });

  it("preserves an unsaved connection edit across focus and timer-driven refresh", async () => {
    vi.useFakeTimers({ toFake: ["setInterval", "clearInterval"] });

    const bridge = installBridge({
      connectionConfig: {
        connectionAddress: "https://initial.example.com",
      },
      hostInfo: { hostKind: "android-host" },
      peers: [],
      runtimeSnapshot: {
        activeConnectionAddr: "/dns4/bootstrap.example.com/tcp/443/tls/ws/p2p/12D3KooWBootstrap",
        currentNode: { peerId: "android-peer" },
        status: "discovering",
      },
    });

    render(<Probe />);

    await waitFor(() => {
      expect(screen.getByTestId("server-url").textContent).toBe("https://initial.example.com");
    });
    expect(screen.getByTestId("server-url-input").textContent).toBe("https://initial.example.com");

    fireEvent.click(screen.getByRole("button", { name: "draft" }));
    expect(screen.getByTestId("server-url-input").textContent).toBe("https://draft.example.com");

    bridge.setState({
      connectionConfig: {
        connectionAddress: "https://focused.example.com",
      },
      hostInfo: { hostKind: "android-host" },
      peers: [],
      runtimeSnapshot: {
        activeConnectionAddr: "/dns4/bootstrap.example.com/tcp/443/tls/ws/p2p/12D3KooWBootstrap",
        currentNode: { peerId: "android-peer" },
        status: "discovering",
      },
    });

    fireEvent(window, new Event("focus"));

    await waitFor(() => {
      expect(screen.getByTestId("server-url").textContent).toBe("https://focused.example.com");
    });
    expect(screen.getByTestId("server-url-input").textContent).toBe("https://draft.example.com");

    bridge.setState({
      connectionConfig: {
        connectionAddress: "https://polled.example.com",
      },
      hostInfo: { hostKind: "android-host" },
      peers: [],
      runtimeSnapshot: {
        activeConnectionAddr: "/dns4/bootstrap.example.com/tcp/443/tls/ws/p2p/12D3KooWBootstrap",
        currentNode: { peerId: "android-peer" },
        status: "discovering",
      },
    });

    await vi.advanceTimersByTimeAsync(5_000);

    await waitFor(() => {
      expect(screen.getByTestId("server-url").textContent).toBe("https://polled.example.com");
    });
    expect(screen.getByTestId("server-url-input").textContent).toBe("https://draft.example.com");
  });
});
