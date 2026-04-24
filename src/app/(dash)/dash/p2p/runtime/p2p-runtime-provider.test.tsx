// @vitest-environment jsdom

import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { P2PShellProvider, useP2PShellState } from "./p2p-runtime-provider";

const {
  useDeviceShellRuntimeMock,
  useServerShellRuntimeMock,
} = vi.hoisted(() => ({
  useDeviceShellRuntimeMock: vi.fn(() => ({
    shellKind: "device-shell",
    currentNode: { peerId: "device-peer" },
    peers: [{ peerId: "peer-a" }],
    status: "peer_candidates_ready",
    diagnostics: {},
    errorMessage: null,
    isConnected: true,
    saveServerUrl: vi.fn(async () => {}),
    serverUrl: "/dns4/bootstrap.example.com/tcp/443/wss/p2p/12D3KooWBootstrap",
    serverUrlInput: "/dns4/bootstrap.example.com/tcp/443/wss/p2p/12D3KooWBootstrap",
    setServerUrlInput: vi.fn(),
  })),
  useServerShellRuntimeMock: vi.fn(() => ({
    shellKind: "server-shell",
    currentNode: { peerId: "server-peer" },
    peers: [],
    status: "peer_candidates_ready",
    diagnostics: {},
    errorMessage: null,
    isConnected: true,
    saveServerUrl: vi.fn(async () => {}),
    serverUrl: "https://gomtm.example.com",
    serverUrlInput: "https://gomtm.example.com",
    setServerUrlInput: vi.fn(),
  })),
}));

vi.mock("./use-server-shell-runtime", () => ({
  useServerShellRuntime: useServerShellRuntimeMock,
}));

vi.mock("./use-android-host-runtime", () => ({
  useDeviceShellRuntime: useDeviceShellRuntimeMock,
}));

function Probe() {
  const runtime = useP2PShellState();
  return (
    <div data-testid="shell-kind">
      {runtime.shellKind}:{runtime.currentNode?.peerId ?? "<none>"}:{runtime.status}:{runtime.peers.length}:{runtime.serverUrl}
    </div>
  );
}

describe("P2PShellProvider", () => {
  beforeEach(() => {
    useDeviceShellRuntimeMock.mockClear();
    useServerShellRuntimeMock.mockClear();
  });

  afterEach(() => {
    cleanup();
    delete (window as Window & { GomtmHostBridge?: unknown }).GomtmHostBridge;
  });

  it("defaults to the server shell when no device bridge exists", () => {
    render(
      <P2PShellProvider>
        <Probe />
      </P2PShellProvider>,
    );

    expect(screen.getByTestId("shell-kind").textContent).toBe(
      "server-shell:server-peer:peer_candidates_ready:0:https://gomtm.example.com",
    );
    expect(useServerShellRuntimeMock).toHaveBeenCalledTimes(1);
  });

  it("reads device shell state from the bridge without creating a direct libp2p runtime", async () => {
    (window as Window & { GomtmHostBridge?: unknown }).GomtmHostBridge = {
      getHostInfo: vi.fn(() => JSON.stringify({ appVersion: "1.0.0", shellKind: "device-shell" })),
    };

    render(
      <P2PShellProvider>
        <Probe />
      </P2PShellProvider>,
    );

    await waitFor(() => {
      expect(screen.getByTestId("shell-kind").textContent).toBe(
        "device-shell:device-peer:peer_candidates_ready:1:/dns4/bootstrap.example.com/tcp/443/wss/p2p/12D3KooWBootstrap",
      );
    });

    expect(useDeviceShellRuntimeMock).toHaveBeenCalledTimes(1);
    expect(useServerShellRuntimeMock).not.toHaveBeenCalled();
  });
});
