// @vitest-environment jsdom

import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { P2PRuntimeProvider, useP2PRuntime } from "./p2p-runtime-provider";

const { useBrowserP2PRuntimeMock } = vi.hoisted(() => ({
  useBrowserP2PRuntimeMock: vi.fn(() => ({
    hostKind: "browser",
    currentNode: { peerId: "browser-peer" },
    peers: [],
  })),
}));

vi.mock("./use-browser-p2p-runtime", () => ({
  useBrowserP2PRuntime: useBrowserP2PRuntimeMock,
}));

function Probe() {
  const runtime = useP2PRuntime();
  return (
    <div data-testid="host-kind">
      {runtime.hostKind}:{runtime.currentNode?.peerId ?? "<none>"}:{runtime.status}:{runtime.peers.length}:{runtime.serverUrl}
    </div>
  );
}

describe("P2PRuntimeProvider", () => {
  beforeEach(() => {
    useBrowserP2PRuntimeMock.mockClear();
  });

  afterEach(() => {
    cleanup();
    delete (window as Window & { GomtmHostBridge?: unknown }).GomtmHostBridge;
  });

  it("defaults to the browser runtime when no Android host bridge exists", () => {
    render(
      <P2PRuntimeProvider>
        <Probe />
      </P2PRuntimeProvider>,
    );

    expect(screen.getByTestId("host-kind").textContent).toBe("browser:browser-peer::0:");
    expect(useBrowserP2PRuntimeMock).toHaveBeenCalledTimes(1);
  });

  it("reads Android host state from the bridge without creating a browser libp2p node", async () => {
    const getHostInfo = vi.fn(() =>
      JSON.stringify({
        appVersion: "1.0.0",
        hostKind: "android-host",
      }),
    );
    const getConnectionConfig = vi.fn(() =>
      JSON.stringify({
        connectionAddress: "/dns4/bootstrap.example.com/tcp/443/wss/p2p/12D3KooWBootstrap",
      }),
    );
    const getRuntimeSnapshot = vi.fn(() =>
      JSON.stringify({
        activeConnectionAddr: "/dns4/bootstrap.example.com/tcp/443/wss/p2p/12D3KooWBootstrap",
        currentNode: { peerId: "android-peer" },
        diagnostics: { runtimeState: "Ready" },
        status: "peer_candidates_ready",
      }),
    );
    const listDiscoveredPeers = vi.fn(() =>
      JSON.stringify([
        {
          lastDiscoveredAt: "2026-04-21T16:00:00.000Z",
          multiaddrs: [],
          peerId: "peer-a",
        },
      ]),
    );

    (window as Window & { GomtmHostBridge?: unknown }).GomtmHostBridge = {
      getConnectionConfig,
      getHostInfo,
      getRuntimeSnapshot,
      listDiscoveredPeers,
    };

    render(
      <P2PRuntimeProvider>
        <Probe />
      </P2PRuntimeProvider>,
    );

    await waitFor(() => {
      expect(screen.getByTestId("host-kind").textContent).toBe(
        "android-host:android-peer:peer_candidates_ready:1:/dns4/bootstrap.example.com/tcp/443/wss/p2p/12D3KooWBootstrap",
      );
    });

    expect(getHostInfo).toHaveBeenCalled();
    expect(getConnectionConfig).toHaveBeenCalled();
    expect(getRuntimeSnapshot).toHaveBeenCalled();
    expect(listDiscoveredPeers).toHaveBeenCalled();
    expect(useBrowserP2PRuntimeMock).not.toHaveBeenCalled();
  });
});
