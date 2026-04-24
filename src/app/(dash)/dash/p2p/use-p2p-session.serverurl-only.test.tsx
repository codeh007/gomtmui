// @vitest-environment jsdom

import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { P2PShellProvider, useP2PShellState } from "./runtime/p2p-runtime-provider";

const { fetchServerPeerDirectoryMock, fetchServerSelfNodeMock } = vi.hoisted(() => ({
  fetchServerPeerDirectoryMock: vi.fn(),
  fetchServerSelfNodeMock: vi.fn(),
}));

vi.mock("@/lib/p2p/server-peer-directory-api", () => ({
  fetchServerPeerDirectory: fetchServerPeerDirectoryMock,
}));

vi.mock("@/lib/p2p/server-self-node-api", () => ({
  fetchServerSelfNode: fetchServerSelfNodeMock,
}));

function SessionProbe() {
  const session = useP2PShellState();

  return (
    <>
      <div data-testid="shell-kind">{session.shellKind}</div>
      <div data-testid="status">{session.status}</div>
      <div data-testid="current-peer-id">{session.currentNode?.peerId ?? ""}</div>
      <div data-testid="peer-count">{String(session.peers.length)}</div>
      <div data-testid="error-message">{session.errorMessage ?? ""}</div>
      <div data-testid="is-connected">{String(session.isConnected)}</div>
      <div data-testid="server-url">{session.serverUrl}</div>
      <div data-testid="server-url-input">{session.serverUrlInput}</div>
    </>
  );
}

afterEach(() => {
  cleanup();
  localStorage.clear();
  vi.restoreAllMocks();
  fetchServerPeerDirectoryMock.mockReset();
  fetchServerSelfNodeMock.mockReset();
});

describe("P2PShellProvider server-shell hard cut", () => {
  it("当后端返回 server self truth 时保持 server-shell 语义且当前节点来自 shell truth", async () => {
    const serverUrl = "https://gomtm2.yuepa8.com";

    fetchServerSelfNodeMock.mockResolvedValue({
      peerId: "12D3KooWShellTruth",
      connectionAddr: "/dns4/gomtm2.yuepa8.com/tcp/443/tls/ws/p2p/12D3KooWShellTruth",
    });
    fetchServerPeerDirectoryMock.mockResolvedValue([
      {
        peerId: "12D3KooWPeerA",
        multiaddrs: ["/dns4/peer-a.example.com/tcp/443/tls/ws/p2p/12D3KooWPeerA"],
        lastSeenAt: "2026-04-23T00:00:00Z",
      },
      {
        peerId: "12D3KooWShellTruth",
        multiaddrs: ["/dns4/gomtm2.yuepa8.com/tcp/443/tls/ws/p2p/12D3KooWShellTruth"],
        lastSeenAt: "2026-04-23T00:01:00Z",
      },
    ]);

    localStorage.setItem("gomtm:p2p:server-url", serverUrl);

    render(
      <P2PShellProvider>
        <SessionProbe />
      </P2PShellProvider>,
    );

    await waitFor(() => {
      expect(screen.getByTestId("status").textContent).toBe("peer_candidates_ready");
    });

    expect(screen.getByTestId("shell-kind").textContent).toBe("server-shell");
    expect(screen.getByTestId("current-peer-id").textContent).toBe("12D3KooWShellTruth");
    expect(screen.getByTestId("peer-count").textContent).toBe("1");
    expect(screen.getByTestId("error-message").textContent).toBe("");
    expect(screen.getByTestId("server-url").textContent).toBe(serverUrl);
    expect(screen.getByTestId("server-url-input").textContent).toBe(serverUrl);
  });

  it("当后端未返回 server self truth 时停在 error 且保持 server-shell 语义", async () => {
    const serverUrl = "https://gomtm2.yuepa8.com";

    fetchServerSelfNodeMock.mockRejectedValue(new Error("gomtm server 未返回 self node truth。"));
    fetchServerPeerDirectoryMock.mockResolvedValue([]);

    localStorage.setItem("gomtm:p2p:server-url", serverUrl);

    render(
      <P2PShellProvider>
        <SessionProbe />
      </P2PShellProvider>,
    );

    await waitFor(() => {
      expect(screen.getByTestId("status").textContent).toBe("error");
    });

    expect(screen.getByTestId("shell-kind").textContent).toBe("server-shell");
    expect(screen.getByTestId("current-peer-id").textContent).toBe("");
    expect(screen.getByTestId("peer-count").textContent).toBe("0");
    expect(screen.getByTestId("error-message").textContent).toBe("gomtm server 未返回 self node truth。");
    expect(screen.getByTestId("server-url").textContent).toBe(serverUrl);
    expect(screen.getByTestId("server-url-input").textContent).toBe(serverUrl);
  });
});
