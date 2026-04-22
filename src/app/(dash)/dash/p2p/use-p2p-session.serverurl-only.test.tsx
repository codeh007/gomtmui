// @vitest-environment jsdom

import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { P2PRuntimeProvider, useP2PRuntime } from "./runtime/p2p-runtime-provider";

vi.mock("./use-live-browser-connection-truth", () => ({
  useLiveBrowserConnectionTruth: vi.fn(() => ({
    accessUrl: null,
    readyServers: [],
    truthQuery: {
      data: null,
      status: "pending",
      error: null,
    },
  })),
}));

import { useLiveBrowserConnectionTruth } from "./use-live-browser-connection-truth";

function SessionProbe() {
  const session = useP2PRuntime();

  return (
    <>
      <div data-testid="status">{session.status}</div>
      <div data-testid="active-connection">{session.activeConnectionAddr}</div>
      <div data-testid="candidate-count">{String(session.peerCandidates.length)}</div>
      <div data-testid="error-message">{session.errorMessage ?? ""}</div>
      <div data-testid="is-connected">{String(session.isConnected)}</div>
      <div data-testid="can-connect">{String(session.canConnect)}</div>
      <div data-testid="server-url">{session.serverUrl}</div>
      <div data-testid="server-url-input">{session.serverUrlInput}</div>
    </>
  );
}

afterEach(() => {
  cleanup();
  localStorage.clear();
  vi.restoreAllMocks();
});

describe("P2PRuntimeProvider", () => {
  it("当后端未返回浏览器可用 connection truth 时停在 error 而不是 needs-server-url", async () => {
    const serverUrl = "https://gomtm2.yuepa8.com";

    vi.mocked(useLiveBrowserConnectionTruth).mockImplementation((inputServerUrl: string) => ({
      accessUrl: inputServerUrl === serverUrl ? serverUrl : null,
      readyServers: inputServerUrl === serverUrl ? [{ id: "server-1", accessUrl: serverUrl }] : [],
      truthQuery:
        inputServerUrl === serverUrl
          ? {
              data: {
                generation: "gen-empty",
                primaryTransport: "ws",
                candidates: [],
              },
              status: "success",
              error: null,
            }
          : {
              data: null,
              status: "pending",
              error: null,
            },
    }) as ReturnType<typeof useLiveBrowserConnectionTruth>);

    localStorage.setItem("gomtm:p2p:server-url", serverUrl);

    render(
      <P2PRuntimeProvider>
        <SessionProbe />
      </P2PRuntimeProvider>,
    );

    await waitFor(() => {
      expect(screen.getByTestId("status").textContent).toBe("error");
    });

    expect(screen.getByTestId("error-message").textContent).toBe("当前后端未返回可用于浏览器的连接信息，请检查 gomtm server 状态。");
  });
});
