// @vitest-environment jsdom

import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { useP2PPeerPageSession } from "./use-p2p-peer-page-session";

const fetchMock = vi.fn();
const originalFetch = globalThis.fetch;
const saveServerUrl = vi.fn(async () => {});
const setServerUrlInput = vi.fn();

function mockCapabilityResponse(capabilities: Array<{ name: string; reason?: string; state?: string }>) {
  fetchMock.mockResolvedValue(
    new Response(JSON.stringify(capabilities), {
      headers: {
        "content-type": "application/json",
      },
      status: 200,
    }),
  );
}

function createPeer(peerId: string, multiaddrs: string[]) {
  return {
    discoveredAt: "2026-04-21T16:00:00.000Z",
    multiaddrs,
    peerId,
  };
}

const mockRuntime = {
  currentNode: null,
  diagnostics: {},
  errorMessage: null,
  shellKind: "device-shell" as "device-shell" | "server-shell",
  isConnected: true,
  peers: [createPeer("12D3KooWPeer", ["/dns4/android.example.com/tcp/443/tls/ws/p2p/12D3KooWPeer"])],
  saveServerUrl,
  serverUrl: "https://gomtm.example.com",
  serverUrlInput: "https://gomtm.example.com",
  setServerUrlInput,
  status: "peer_candidates_ready" as const,
};

vi.mock("../runtime/p2p-runtime-provider", () => ({
  useP2PShellState: () => mockRuntime,
}));

function Probe({ peerId = "12D3KooWPeer" }: { peerId?: string }) {
  const session = useP2PPeerPageSession(peerId);

  return (
    <>
      <div data-testid="peer-id">{session.peerId}</div>
      <div data-testid="peer-value">{session.peer?.peerId ?? "<none>"}</div>
      <div data-testid="peer-truth-status">{session.peerTruthStatus}</div>
      <div data-testid="can-open-android">{String(session.canOpenAndroid)}</div>
      <div data-testid="peer-truth-error">{session.peerTruthErrorMessage ?? ""}</div>
      <div data-testid="is-peer-truth-loading">{String(session.isPeerTruthLoading)}</div>
    </>
  );
}

describe("useP2PPeerPageSession", () => {
  afterEach(() => {
    cleanup();
    fetchMock.mockReset();
    Object.defineProperty(globalThis, "fetch", {
      configurable: true,
      value: originalFetch,
      writable: true,
    });
    saveServerUrl.mockClear();
    setServerUrlInput.mockClear();
    mockRuntime.currentNode = null;
    mockRuntime.errorMessage = null;
    mockRuntime.shellKind = "device-shell";
    mockRuntime.isConnected = true;
    mockRuntime.peers = [createPeer("12D3KooWPeer", ["/dns4/android.example.com/tcp/443/tls/ws/p2p/12D3KooWPeer"])];
    mockRuntime.serverUrl = "https://gomtm.example.com";
    mockRuntime.serverUrlInput = "https://gomtm.example.com";
  });

  it("reads peer capabilities through the gomtm server operator api on device-shell without requiring a local libp2p node", async () => {
    mockRuntime.peers = [createPeer("12D3KooWPeer", [])];
    mockCapabilityResponse([
      {
        name: "android.native_remote_v2_webrtc",
        reason: "ready",
        state: "available",
      },
    ]);

    Object.defineProperty(globalThis, "fetch", {
      configurable: true,
      value: fetchMock,
      writable: true,
    });

    render(<Probe />);

    await waitFor(() => {
      expect(screen.getByTestId("peer-truth-status").textContent).toBe("ready");
    });

    expect(screen.getByTestId("can-open-android").textContent).toBe("true");
    expect(screen.getByTestId("peer-truth-error").textContent).toBe("");
    expect(fetchMock).toHaveBeenCalledWith(
      "https://gomtm.example.com/api/p2p/peers/12D3KooWPeer/capabilities",
      {
        cache: "no-store",
        credentials: "omit",
        method: "GET",
      },
    );
  });

  it("server-shell still reads capabilities through the gomtm server operator api", async () => {
    mockRuntime.shellKind = "server-shell";
    mockRuntime.peers = [createPeer("12D3KooWPeer", ["/ip4/10.0.0.1/tcp/4001/p2p/12D3KooWPeer"])];
    mockCapabilityResponse([
      {
        name: "android.native_remote_v2_webrtc",
        reason: "ready",
        state: "available",
      },
    ]);

    Object.defineProperty(globalThis, "fetch", {
      configurable: true,
      value: fetchMock,
      writable: true,
    });

    render(<Probe />);

    await waitFor(() => {
      expect(screen.getByTestId("peer-truth-status").textContent).toBe("ready");
    });

    expect(screen.getByTestId("peer-truth-error").textContent).toBe("");
    expect(screen.getByTestId("can-open-android").textContent).toBe("true");
    expect(fetchMock).toHaveBeenCalledWith(
      "https://gomtm.example.com/api/p2p/peers/12D3KooWPeer/capabilities",
      {
        cache: "no-store",
        credentials: "omit",
        method: "GET",
      },
    );
  });

  it("loads capabilities from the gomtm server even when the peer is not locally discovered", async () => {
    mockRuntime.peers = [];
    mockCapabilityResponse([
      {
        name: "android.native_remote_v2_webrtc",
        reason: "ready",
        state: "available",
      },
    ]);

    Object.defineProperty(globalThis, "fetch", {
      configurable: true,
      value: fetchMock,
      writable: true,
    });

    render(<Probe />);

    await waitFor(() => {
      expect(screen.getByTestId("peer-truth-status").textContent).toBe("ready");
    });

    expect(screen.getByTestId("peer-value").textContent).toBe("<none>");
    expect(screen.getByTestId("can-open-android").textContent).toBe("true");
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("clears sticky peer data immediately when peerId changes before the next server-backed load settles", async () => {
    fetchMock
      .mockResolvedValueOnce(
        new Response(JSON.stringify([]), {
          headers: {
            "content-type": "application/json",
          },
          status: 200,
        }),
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify([]), {
          headers: {
            "content-type": "application/json",
          },
          status: 200,
        }),
      );

    Object.defineProperty(globalThis, "fetch", {
      configurable: true,
      value: fetchMock,
      writable: true,
    });

    const rendered = render(<Probe peerId="12D3KooWPeer" />);

    await waitFor(() => {
      expect(screen.getByTestId("peer-value").textContent).toBe("12D3KooWPeer");
    });

    rendered.rerender(<Probe peerId="12D3KooWMissing" />);

    await waitFor(() => {
      expect(screen.getByTestId("peer-value").textContent).toBe("<none>");
    });
    expect(["idle", "loading", "ready"]).toContain(screen.getByTestId("peer-truth-status").textContent);
    expect(screen.getByTestId("peer-truth-error").textContent).toBe("");
  });

  it("clears local capability overrides when the runtime session identity changes without auto-refetching from the server", async () => {
    mockRuntime.currentNode = { peerId: "android-host-a" };
    fetchMock.mockResolvedValueOnce(
      new Response(
        JSON.stringify([
          {
            name: "android.native_remote_v2_webrtc",
            reason: "ready",
            state: "available",
          },
        ]),
        {
          headers: {
            "content-type": "application/json",
          },
          status: 200,
        },
      ),
    );

    Object.defineProperty(globalThis, "fetch", {
      configurable: true,
      value: fetchMock,
      writable: true,
    });

    const rendered = render(<Probe />);

    await waitFor(() => {
      expect(screen.getByTestId("peer-truth-status").textContent).toBe("ready");
    });
    expect(screen.getByTestId("can-open-android").textContent).toBe("true");

    mockRuntime.currentNode = { peerId: "android-host-b" };
    rendered.rerender(<Probe />);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    await waitFor(() => {
      expect(screen.getByTestId("can-open-android").textContent).toBe("false");
    });
  });
});
