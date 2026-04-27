// @vitest-environment jsdom

import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { P2PShellProvider, useP2PShellState } from "./p2p-runtime-provider";

const { useServerShellRuntimeMock } = vi.hoisted(() => ({
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

  it("keeps server-shell semantics even when an Android host bridge exists", async () => {
    (window as Window & { GomtmHostBridge?: unknown }).GomtmHostBridge = {
      getHostInfo: vi.fn(() => JSON.stringify({ appVersion: "1.0.0", hostKind: "android-host" })),
    };

    render(
      <P2PShellProvider>
        <Probe />
      </P2PShellProvider>,
    );

    await waitFor(() => {
      expect(screen.getByTestId("shell-kind").textContent).toBe(
        "server-shell:server-peer:peer_candidates_ready:0:https://gomtm.example.com",
      );
    });

    expect(useServerShellRuntimeMock).toHaveBeenCalledTimes(1);
  });
});
