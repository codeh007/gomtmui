// @vitest-environment jsdom

import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { useP2PPeerPageSession } from "./use-p2p-peer-page-session";

const fetchMock = vi.fn();
const originalFetch = globalThis.fetch;
const connect = vi.fn(async () => false);
const saveConnection = vi.fn(async () => {});
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

function createPeerCandidate(peerId: string, multiaddrs: string[]) {
  return {
    lastDiscoveredAt: "2026-04-21T16:00:00.000Z",
    multiaddrs,
    peerId,
  };
}

const mockRuntime = {
  activeConnectionAddr: "",
  canConnect: false,
  connect,
  currentNode: null,
  debugConnectPhase: "android-host",
  debugLastError: null,
  diagnostics: {},
  errorMessage: null,
  hostKind: "android-host" as "android-host" | "browser",
  isConnected: true,
  peerCandidates: [createPeerCandidate("12D3KooWPeer", ["/dns4/android.example.com/tcp/443/tls/ws/p2p/12D3KooWPeer"])],
  peers: [],
  saveConnection,
  saveServerUrl,
  serverUrl: "https://gomtm.example.com",
  serverUrlInput: "https://gomtm.example.com",
  setServerUrlInput,
  status: "peer_candidates_ready" as const,
};

vi.mock("../runtime/p2p-runtime-provider", () => ({
  useP2PRuntime: () => mockRuntime,
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
    connect.mockClear();
    saveConnection.mockClear();
    saveServerUrl.mockClear();
    setServerUrlInput.mockClear();
    mockRuntime.activeConnectionAddr = "";
    mockRuntime.currentNode = null;
    mockRuntime.errorMessage = null;
    mockRuntime.hostKind = "android-host";
    mockRuntime.isConnected = true;
    mockRuntime.peerCandidates = [createPeerCandidate("12D3KooWPeer", ["/dns4/android.example.com/tcp/443/tls/ws/p2p/12D3KooWPeer"])];
    mockRuntime.serverUrl = "https://gomtm.example.com";
    mockRuntime.serverUrlInput = "https://gomtm.example.com";
  });

  it("reads peer capabilities through the gomtm server operator api on android-host without requiring a browser node", async () => {
    mockRuntime.peerCandidates = [createPeerCandidate("12D3KooWPeer", [])];
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

  it("browser host still reads capabilities through the gomtm server operator api when the peer is not browser-dialable", async () => {
    mockRuntime.hostKind = "browser";
    mockRuntime.activeConnectionAddr = "/dns4/bootstrap.example.com/tcp/443/wss/p2p/12D3KooWBootstrap";
    mockRuntime.peerCandidates = [createPeerCandidate("12D3KooWPeer", ["/ip4/10.0.0.1/tcp/4001/p2p/12D3KooWPeer"] )];
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
    mockRuntime.peerCandidates = [];
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
    mockRuntime.activeConnectionAddr = "/dns4/bootstrap-a.example.com/tcp/443/tls/ws/p2p/12D3KooWA";
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
    mockRuntime.activeConnectionAddr = "/dns4/bootstrap-b.example.com/tcp/443/tls/ws/p2p/12D3KooWB";
    rendered.rerender(<Probe />);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    await waitFor(() => {
      expect(screen.getByTestId("can-open-android").textContent).toBe("false");
    });
  });
});
