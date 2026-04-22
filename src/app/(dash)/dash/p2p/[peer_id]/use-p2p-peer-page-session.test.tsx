// @vitest-environment jsdom

import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { useP2PPeerPageSession } from "./use-p2p-peer-page-session";

const getResolvedPeerCapabilities = vi.fn(() => null);
const readPeerCapabilities = vi.fn();
const getResolvedPeerTruth = vi.fn(() => null);
const connect = vi.fn(async () => false);
const resolvePeerCapabilityReadAddress = vi.fn(async (peerId: string) => {
  const targetPeer = mockRuntime.peerCandidates.find((candidate) => candidate.peerId === peerId) ?? null;
  return targetPeer?.multiaddrs.find((value) => value.trim() !== "") ?? null;
});
const saveConnection = vi.fn(async () => {});
const saveServerUrl = vi.fn(async () => {});
const setServerUrlInput = vi.fn();

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
  getResolvedPeerCapabilities,
  getResolvedPeerTruth,
  hostKind: "android-host" as "android-host" | "browser",
  isConnected: true,
  peerCandidates: [createPeerCandidate("12D3KooWPeer", ["/dns4/android.example.com/tcp/443/tls/ws/p2p/12D3KooWPeer"])],
  peers: [],
  readPeerCapabilities,
  resolvePeerCapabilityReadAddress,
  saveConnection,
  saveServerUrl,
  serverUrl: "",
  serverUrlInput: "",
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
      <div data-testid="target-address">{session.targetAddress ?? "<none>"}</div>
      <div data-testid="peer-truth-error">{session.peerTruthErrorMessage ?? ""}</div>
    </>
  );
}

describe("useP2PPeerPageSession", () => {
  afterEach(() => {
    cleanup();
    getResolvedPeerCapabilities.mockReset();
    getResolvedPeerCapabilities.mockReturnValue(null);
    readPeerCapabilities.mockReset();
    getResolvedPeerTruth.mockReset();
    getResolvedPeerTruth.mockReturnValue(null);
    resolvePeerCapabilityReadAddress.mockReset();
    resolvePeerCapabilityReadAddress.mockImplementation(async (peerId: string) => {
      const targetPeer = mockRuntime.peerCandidates.find((candidate) => candidate.peerId === peerId) ?? null;
      return targetPeer?.multiaddrs.find((value) => value.trim() !== "") ?? null;
    });
    connect.mockClear();
    saveConnection.mockClear();
    saveServerUrl.mockClear();
    setServerUrlInput.mockClear();
    mockRuntime.activeConnectionAddr = "";
    mockRuntime.errorMessage = null;
    mockRuntime.hostKind = "android-host";
    mockRuntime.isConnected = true;
    mockRuntime.peerCandidates = [createPeerCandidate("12D3KooWPeer", ["/dns4/android.example.com/tcp/443/tls/ws/p2p/12D3KooWPeer"])];
  });

  it("reads peer capabilities through the runtime on android-host without requiring a browser node", async () => {
    mockRuntime.peerCandidates = [createPeerCandidate("12D3KooWPeer", [])];
    resolvePeerCapabilityReadAddress.mockResolvedValue(null);
    readPeerCapabilities.mockResolvedValue([
      {
        name: "android.native_remote_v2_webrtc",
        reason: "ready",
        state: "available",
      },
    ]);

    render(<Probe />);

    await waitFor(() => {
      expect(screen.getByTestId("peer-truth-status").textContent).toBe("ready");
    });

    expect(screen.getByTestId("can-open-android").textContent).toBe("true");
    expect(screen.getByTestId("target-address").textContent).toBe("12D3KooWPeer");
    expect(screen.getByTestId("peer-truth-error").textContent).toBe("");
    expect(readPeerCapabilities).toHaveBeenCalledWith("12D3KooWPeer", undefined);
  });

  it("reports browser-dialable failure when only non-browser-dialable multiaddrs exist", async () => {
    mockRuntime.hostKind = "browser";
    mockRuntime.activeConnectionAddr = "/dns4/bootstrap.example.com/tcp/443/wss/p2p/12D3KooWBootstrap";
    mockRuntime.peerCandidates = [createPeerCandidate("12D3KooWPeer", ["/ip4/10.0.0.1/tcp/4001/p2p/12D3KooWPeer"])];
    resolvePeerCapabilityReadAddress.mockResolvedValue(null);

    render(<Probe />);

    await waitFor(() => {
      expect(screen.getByTestId("peer-truth-status").textContent).toBe("error");
    });

    expect(screen.getByTestId("target-address").textContent).toBe("<none>");
    expect(screen.getByTestId("peer-truth-error").textContent).toBe(
      "目标节点当前没有 browser-dialable multiaddr，无法读取节点能力。",
    );
    expect(readPeerCapabilities).not.toHaveBeenCalled();
  });

  it("uses the runtime-resolved browser capability entrypoint when a direct dialable address exists", async () => {
    mockRuntime.hostKind = "browser";
    mockRuntime.activeConnectionAddr = "/dns4/bootstrap.example.com/tcp/443/wss/p2p/12D3KooWBootstrap";
    mockRuntime.peerCandidates = [createPeerCandidate("12D3KooWPeer", ["/dns4/direct.example.com/udp/443/quic-v1/webtransport/p2p/12D3KooWPeer"])];
    resolvePeerCapabilityReadAddress.mockResolvedValue("/dns4/direct.example.com/udp/443/quic-v1/webtransport/p2p/12D3KooWPeer");
    readPeerCapabilities.mockResolvedValue([]);

    render(<Probe />);

    await waitFor(() => {
      expect(screen.getByTestId("peer-truth-status").textContent).toBe("ready");
    });

    expect(screen.getByTestId("target-address").textContent).toBe(
      "/dns4/direct.example.com/udp/443/quic-v1/webtransport/p2p/12D3KooWPeer",
    );
    expect(screen.getByTestId("peer-truth-error").textContent).toBe("");
    expect(readPeerCapabilities).toHaveBeenCalledWith("12D3KooWPeer", undefined);
  });

  it("clears sticky peer data immediately when peerId changes", async () => {
    readPeerCapabilities.mockResolvedValue([]);

    const rendered = render(<Probe peerId="12D3KooWPeer" />);

    await waitFor(() => {
      expect(screen.getByTestId("peer-value").textContent).toBe("12D3KooWPeer");
    });
    await waitFor(() => {
      expect(screen.getByTestId("target-address").textContent).toBe("/dns4/android.example.com/tcp/443/tls/ws/p2p/12D3KooWPeer");
    });

    rendered.rerender(<Probe peerId="12D3KooWMissing" />);

    await waitFor(() => {
      expect(screen.getByTestId("peer-value").textContent).toBe("<none>");
    });
    expect(screen.getByTestId("target-address").textContent).toBe("<none>");
    expect(screen.getByTestId("peer-truth-status").textContent).toBe("idle");
    expect(screen.getByTestId("peer-truth-error").textContent).toBe("");
  });

  it("clears local capability overrides when the runtime session identity changes", async () => {
    mockRuntime.currentNode = { peerId: "android-host-a" };
    mockRuntime.activeConnectionAddr = "/dns4/bootstrap-a.example.com/tcp/443/tls/ws/p2p/12D3KooWA";
    readPeerCapabilities.mockResolvedValueOnce([
      {
        name: "android.native_remote_v2_webrtc",
        reason: "ready",
        state: "available",
      },
    ]);
    readPeerCapabilities.mockResolvedValueOnce([]);

    const rendered = render(<Probe />);

    await waitFor(() => {
      expect(screen.getByTestId("peer-truth-status").textContent).toBe("ready");
    });
    expect(screen.getByTestId("can-open-android").textContent).toBe("true");

    mockRuntime.currentNode = { peerId: "android-host-b" };
    mockRuntime.activeConnectionAddr = "/dns4/bootstrap-b.example.com/tcp/443/tls/ws/p2p/12D3KooWB";
    rendered.rerender(<Probe />);

    await waitFor(() => {
      expect(readPeerCapabilities).toHaveBeenCalledTimes(2);
    });
    await waitFor(() => {
      expect(screen.getByTestId("can-open-android").textContent).toBe("false");
    });
  });
});
