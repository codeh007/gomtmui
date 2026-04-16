// @vitest-environment jsdom

import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  __resetP2PSessionDepsForTest,
  __setP2PSessionDepsForTest,
  P2PSessionProvider,
  useP2PSession,
} from "./use-p2p-session";

const originalFetch = globalThis.fetch;

function SessionProbe() {
  const session = useP2PSession();

  return (
    <>
      <div data-testid="status">{session.status}</div>
      <div data-testid="bootstrap-input">{session.bootstrapInput}</div>
    </>
  );
}

afterEach(() => {
  cleanup();
  __resetP2PSessionDepsForTest();
  vi.restoreAllMocks();
  globalThis.fetch = originalFetch;
});

describe("P2PSessionProvider", () => {
  it("does not request system status when no local bootstrap is stored", async () => {
    const fetchMock = vi.fn();
    globalThis.fetch = fetchMock as typeof globalThis.fetch;

    __setP2PSessionDepsForTest({
      readStoredBootstrapTarget: () => ({}),
    });

    render(
      <P2PSessionProvider>
        <SessionProbe />
      </P2PSessionProvider>,
    );

    await waitFor(() => {
      expect(screen.getByTestId("status").textContent).toBe("needs-bootstrap");
    });

    expect(screen.getByTestId("bootstrap-input").textContent).toBe("");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("passes wss bootstrap target to createBrowserNode", async () => {
    const start = vi.fn(async () => {});
    const stop = vi.fn(async () => {});
    const awaitReady = vi.fn(async () => {});
    const listPeerCandidates = vi.fn(async () => []);
    const addEventListener = vi.fn();
    const removeEventListener = vi.fn();
    const createBrowserNode = vi.fn(async () => ({
      status: "stopped",
      start,
      stop,
      addEventListener,
      removeEventListener,
      services: {
        rendezvousDiscovery: {
          awaitReady,
          listPeerCandidates,
        },
      },
    }));

    __setP2PSessionDepsForTest({
      createBrowserNode,
      readStoredBootstrapTarget: () => ({
        bootstrapAddr: "/dns4/p2p.example.com/tcp/443/tls/ws/p2p/12D3KooWBootstrap",
      }),
    });

    render(
      <P2PSessionProvider>
        <SessionProbe />
      </P2PSessionProvider>,
    );

    await waitFor(() => {
      expect(createBrowserNode).toHaveBeenCalledWith({
        bootstrapAddr: "/dns4/p2p.example.com/tcp/443/tls/ws/p2p/12D3KooWBootstrap",
        transport: "wss",
      });
    });

    await waitFor(() => {
      expect(screen.getByTestId("status").textContent).toBe("peer_candidates_ready");
    });
  });
});
