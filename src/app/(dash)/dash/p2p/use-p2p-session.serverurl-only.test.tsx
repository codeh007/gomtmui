// @vitest-environment jsdom

import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  __resetP2PSessionDepsForTest,
  __setP2PSessionDepsForTest,
  P2PSessionProvider,
  useP2PSession,
} from "./use-p2p-session";

vi.mock("./use-live-browser-bootstrap-truth", () => ({
  useLiveBrowserBootstrapTruth: vi.fn(() => ({
    accessUrl: null,
    readyServers: [],
    truthQuery: {
      data: null,
      status: "pending",
      error: null,
    },
  })),
}));

import { useLiveBrowserBootstrapTruth } from "./use-live-browser-bootstrap-truth";

function SessionProbe() {
  const session = useP2PSession();

  return (
    <>
      <div data-testid="status">{session.status}</div>
      <div data-testid="active-bootstrap">{session.activeBootstrapAddr}</div>
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
  __resetP2PSessionDepsForTest();
  vi.restoreAllMocks();
});

describe("P2PSessionProvider", () => {
  it("当后端未返回浏览器可用 bootstrap truth 时停在 error 而不是 needs-bootstrap", async () => {
    const serverUrl = "https://gomtm2.yuepa8.com";

    vi.mocked(useLiveBrowserBootstrapTruth).mockImplementation((inputServerUrl: string) => ({
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
    }) as ReturnType<typeof useLiveBrowserBootstrapTruth>);

    localStorage.setItem("gomtm:p2p:bootstrap-server-url", serverUrl);

    render(
      <P2PSessionProvider>
        <SessionProbe />
      </P2PSessionProvider>,
    );

    await waitFor(() => {
      expect(screen.getByTestId("status").textContent).toBe("error");
    });

    expect(screen.getByTestId("error-message").textContent).toBe("当前后端未返回可用于浏览器的连接信息，请检查 gomtm server 状态。");
  });
});
