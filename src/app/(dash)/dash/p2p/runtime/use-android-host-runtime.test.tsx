// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { useAndroidHostRuntime } from "./use-android-host-runtime";

function installBridge(state: {
  connectionConfig: unknown;
  hostInfo: unknown;
  peers: unknown;
  runtimeSnapshot: unknown;
}) {
  let currentState = state;

  const bridge = {
    getConnectionConfig: () => JSON.stringify(currentState.connectionConfig),
    getHostInfo: () => JSON.stringify(currentState.hostInfo),
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
