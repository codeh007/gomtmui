// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { useP2PPeerRemotePageSession } from "./use-p2p-peer-remote-page-session";

const { mockRuntime, postServerPeerRemoteCommand } = vi.hoisted(() => ({
  mockRuntime: {
    activeConnectionAddr: "/dns4/bootstrap.example.com/tcp/443/tls/ws/p2p/12D3KooWBootstrap",
    canConnect: true,
    connect: vi.fn(async () => true),
    currentNode: null,
    debugConnectPhase: "android-host",
    debugLastError: null,
    diagnostics: { runtime_status: "ready" },
    errorMessage: null,
    hostKind: "android-host" as const,
    isConnected: true,
    peerCandidates: [],
    peers: [],
    saveConnection: vi.fn(async () => {}),
    saveServerUrl: vi.fn(async () => {}),
    serverUrl: "https://gomtm.example.com",
    serverUrlInput: "https://gomtm.example.com",
    setServerUrlInput: vi.fn(),
    status: "peer_candidates_ready" as const,
  },
  postServerPeerRemoteCommand: vi.fn(),
}));

vi.mock("../../runtime/p2p-runtime-provider", () => ({
  useP2PRuntime: () => mockRuntime,
}));

vi.mock("@/lib/p2p/server-peer-operator-api", () => ({
  postServerPeerRemoteCommand,
}));

function Probe({ peerId = "12D3KooWPeer" }: { peerId?: string }) {
  const session = useP2PPeerRemotePageSession(peerId);

  return (
      <>
        <div data-testid="snapshot-data-url">{session.snapshotDataUrl ?? ""}</div>
        <div data-testid="error-message">{session.errorMessage ?? ""}</div>
        <div data-testid="busy">{String(session.busy)}</div>
        <button onClick={() => void session.sendHome()}>home</button>
        <button onClick={() => void session.sendBack()}>back</button>
      </>
  );
}

describe("useP2PPeerRemotePageSession", () => {
  afterEach(() => {
    cleanup();
    postServerPeerRemoteCommand.mockReset();
    mockRuntime.errorMessage = null;
    mockRuntime.isConnected = true;
    mockRuntime.serverUrl = "https://gomtm.example.com";
    mockRuntime.status = "peer_candidates_ready";
  });

  it("loads an initial screenshot via screen.snapshot and stores a png data url", async () => {
    postServerPeerRemoteCommand.mockResolvedValue({ imageBase64: "c25hcHNob3Q=" });

    render(<Probe />);

    await waitFor(() => {
      expect(screen.getByTestId("snapshot-data-url").textContent).toBe("data:image/png;base64,c25hcHNob3Q=");
    });

    expect(postServerPeerRemoteCommand).toHaveBeenCalledWith({
      command: "screen.snapshot",
      params: { format: "png" },
      peerId: "12D3KooWPeer",
      serverUrl: "https://gomtm.example.com",
    });
  });

  it("does not send remote commands on mount while disconnected and keeps the runtime error visible", async () => {
    mockRuntime.errorMessage = "请先在 P2P 主页面连接服务器。";
    mockRuntime.isConnected = false;
    mockRuntime.status = "needs-server-url";

    render(<Probe />);

    await waitFor(() => {
      expect(screen.getByTestId("error-message").textContent).toBe("请先在 P2P 主页面连接服务器。");
    });

    expect(postServerPeerRemoteCommand).not.toHaveBeenCalled();
    expect(screen.getByTestId("snapshot-data-url").textContent).toBe("");
  });

  it("sending HOME or BACK posts input.key and then refreshes the screenshot", async () => {
    postServerPeerRemoteCommand
      .mockResolvedValueOnce({ imageBase64: "aW5pdGlhbA==" })
      .mockResolvedValueOnce({ ok: true })
      .mockResolvedValueOnce({ imageBase64: "aG9tZQ==" })
      .mockResolvedValueOnce({ ok: true })
      .mockResolvedValueOnce({ imageBase64: "YmFjaw==" });

    render(<Probe />);

    await waitFor(() => {
      expect(screen.getByTestId("snapshot-data-url").textContent).toBe("data:image/png;base64,aW5pdGlhbA==");
    });

    fireEvent.click(screen.getByRole("button", { name: "home" }));

    await waitFor(() => {
      expect(screen.getByTestId("snapshot-data-url").textContent).toBe("data:image/png;base64,aG9tZQ==");
    });

    fireEvent.click(screen.getByRole("button", { name: "back" }));

    await waitFor(() => {
      expect(screen.getByTestId("snapshot-data-url").textContent).toBe("data:image/png;base64,YmFjaw==");
    });

    expect(postServerPeerRemoteCommand.mock.calls.map(([payload]) => payload)).toEqual([
      {
        command: "screen.snapshot",
        params: { format: "png" },
        peerId: "12D3KooWPeer",
        serverUrl: "https://gomtm.example.com",
      },
      {
        command: "input.key",
        params: { key: "HOME" },
        peerId: "12D3KooWPeer",
        serverUrl: "https://gomtm.example.com",
      },
      {
        command: "screen.snapshot",
        params: { format: "png" },
        peerId: "12D3KooWPeer",
        serverUrl: "https://gomtm.example.com",
      },
      {
        command: "input.key",
        params: { key: "BACK" },
        peerId: "12D3KooWPeer",
        serverUrl: "https://gomtm.example.com",
      },
      {
        command: "screen.snapshot",
        params: { format: "png" },
        peerId: "12D3KooWPeer",
        serverUrl: "https://gomtm.example.com",
      },
    ]);
  });

  it("ignores stale snapshot results after the peer changes", async () => {
    let resolveFirstSnapshot: ((value: { imageBase64: string }) => void) | null = null;
    postServerPeerRemoteCommand
      .mockImplementationOnce(
        () =>
          new Promise((resolve) => {
            resolveFirstSnapshot = resolve;
          }),
      )
      .mockResolvedValueOnce({ imageBase64: "c2Vjb25k" });

    const rendered = render(<Probe peerId="12D3KooWPeerA" />);

    rendered.rerender(<Probe peerId="12D3KooWPeerB" />);

    await waitFor(() => {
      expect(screen.getByTestId("snapshot-data-url").textContent).toBe("data:image/png;base64,c2Vjb25k");
    });

    resolveFirstSnapshot?.({ imageBase64: "Zmlyc3Q=" });

    await waitFor(() => {
      expect(screen.getByTestId("snapshot-data-url").textContent).toBe("data:image/png;base64,c2Vjb25k");
    });
  });
});
