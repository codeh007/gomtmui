// @vitest-environment jsdom

import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  __resetP2PSessionDepsForTest,
  __setP2PSessionDepsForTest,
  describeBootstrapJoinError,
  P2PSessionProvider,
  useP2PSession,
} from "./use-p2p-session";

const originalFetch = globalThis.fetch;

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
      <div data-testid="bootstrap-input">{session.bootstrapInput}</div>
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
  __resetP2PSessionDepsForTest();
  vi.restoreAllMocks();
  globalThis.fetch = originalFetch;
});

describe("P2PSessionProvider", () => {
  it("does not request system status when no local bootstrap is stored", async () => {
    const fetchMock = vi.fn();
    globalThis.fetch = fetchMock as typeof globalThis.fetch;

    vi.mocked(useLiveBrowserBootstrapTruth).mockReturnValue({
      accessUrl: null,
      readyServers: [],
      truthQuery: {
        data: null,
        status: "success",
        error: null,
      },
    } as ReturnType<typeof useLiveBrowserBootstrapTruth>);

    __setP2PSessionDepsForTest({
      readStoredBootstrapTarget: () => ({}),
    });

    render(
      <P2PSessionProvider>
        <SessionProbe />
      </P2PSessionProvider>,
    );

    await waitFor(() => {
      expect(screen.getByTestId("status").textContent).toBe("needs-server-url");
    });

    expect(screen.getByTestId("bootstrap-input").textContent).toBe("");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("uses live bootstrap truth as default input when local storage is empty", async () => {
    const createBrowserNode = vi.fn(async () => ({
      status: "started",
      start: vi.fn(async () => {}),
      stop: vi.fn(async () => {}),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      services: {
        rendezvousDiscovery: {
          awaitReady: vi.fn(async () => {}),
          listPeerCandidates: vi.fn(async () => [
            {
              label: "android",
              multiaddrs: ["/dns4/android.example.com/tcp/443/ws/p2p/12D3KooWPeer"],
              peerId: "12D3KooWPeer",
            },
          ]),
        },
      },
    }));

    const serverUrl = "https://gomtm2.yuepa8.com";
    const bootstrapAddr = "/dns4/gomtm2.yuepa8.com/tcp/443/ws/p2p/12D3KooWBootstrap";

    vi.mocked(useLiveBrowserBootstrapTruth).mockImplementation((inputServerUrl: string) => ({
      accessUrl: inputServerUrl === serverUrl ? serverUrl : null,
      readyServers: inputServerUrl === serverUrl ? [{ id: "server-1", accessUrl: serverUrl }] : [],
      truthQuery:
        inputServerUrl === serverUrl
          ? {
              data: {
                generation: "gen-1",
                primaryTransport: "ws",
                candidates: [
                  {
                    transport: "ws",
                    addr: bootstrapAddr,
                    priority: 50,
                  },
                ],
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

    __setP2PSessionDepsForTest({
      createBrowserNode,
      readStoredBootstrapTarget: () => ({}),
      assertBrowserP2PSupport: () => {},
    });

    localStorage.setItem("gomtm:p2p:bootstrap-server-url", serverUrl);

    render(
      <P2PSessionProvider>
        <SessionProbe />
      </P2PSessionProvider>,
    );

    await waitFor(() => {
      expect(screen.getByTestId("status").textContent).toBe("peer_candidates_ready");
    });

    expect(screen.getByTestId("bootstrap-input").textContent).toBe(bootstrapAddr);
    expect(screen.getByTestId("active-bootstrap").textContent).toBe(bootstrapAddr);
    expect(screen.getByTestId("candidate-count").textContent).toBe("1");
    expect(screen.getByTestId("is-connected").textContent).toBe("false");
    expect(screen.getByTestId("can-connect").textContent).toBe("false");
    expect(screen.getByTestId("server-url").textContent).toBe("");
    expect(screen.getByTestId("server-url-input").textContent).toBe("");
    expect(createBrowserNode).toHaveBeenCalledWith({
      bootstrapAddr,
      transport: "ws",
    });
  });

  it("passes ws bootstrap target to createBrowserNode", async () => {
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

    const serverUrl = "https://gomtm2.yuepa8.com";
    const bootstrapAddr = "/dns4/p2p.example.com/tcp/443/ws/p2p/12D3KooWBootstrap";

    vi.mocked(useLiveBrowserBootstrapTruth).mockImplementation((inputServerUrl: string) => ({
      accessUrl: inputServerUrl === serverUrl ? serverUrl : null,
      readyServers: inputServerUrl === serverUrl ? [{ id: "server-1", accessUrl: serverUrl }] : [],
      truthQuery:
        inputServerUrl === serverUrl
          ? {
              data: {
                generation: "gen-1",
                primaryTransport: "ws",
                candidates: [
                  {
                    transport: "ws",
                    addr: bootstrapAddr,
                    priority: 50,
                  },
                ],
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

    __setP2PSessionDepsForTest({
      createBrowserNode,
      readStoredBootstrapTarget: () => ({}),
    });

    localStorage.setItem("gomtm:p2p:bootstrap-server-url", serverUrl);

    render(
      <P2PSessionProvider>
        <SessionProbe />
      </P2PSessionProvider>,
    );

    await waitFor(() => {
      expect(screen.getByTestId("status").textContent).toBe("peer_candidates_ready");
    });

    expect(screen.getByTestId("active-bootstrap").textContent).toBe(bootstrapAddr);
    expect(screen.getByTestId("is-connected").textContent).toBe("true");
    expect(screen.getByTestId("can-connect").textContent).toBe("true");
    expect(screen.getByTestId("server-url").textContent).toBe(serverUrl);
    expect(screen.getByTestId("server-url-input").textContent).toBe(serverUrl);
    expect(createBrowserNode).toHaveBeenCalledWith({
      bootstrapAddr,
      transport: "ws",
    });
  });

  it("normalizes wss bootstrap target from storage before joining", async () => {
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
        bootstrapAddr: "/dns4/p2p.example.com/tcp/443/wss/p2p/12D3KooWBootstrap",
      }),
    });

    render(
      <P2PSessionProvider>
        <SessionProbe />
      </P2PSessionProvider>,
    );

    await waitFor(() => {
      expect(screen.getByTestId("status").textContent).toBe("needs-server-url");
    });
  });

  it("stays in joining when bootstrap connect success never commits discovery state", async () => {
    const start = vi.fn(async () => {});
    const stop = vi.fn(async () => {});
    const awaitReady = vi.fn(async () => {});
    const listPeerCandidates = vi.fn(async () => []);
    const addEventListener = vi.fn();
    const removeEventListener = vi.fn();
    const createBrowserNode = vi.fn(async () => ({
      status: "started",
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

    const serverUrl = "https://gomtm2.yuepa8.com";
    const bootstrapAddr = "/dns4/gomtm2.yuepa8.com/tcp/443/ws/p2p/12D3KooWBootstrap";

    vi.mocked(useLiveBrowserBootstrapTruth).mockImplementation((inputServerUrl: string) => ({
      accessUrl: inputServerUrl === serverUrl ? serverUrl : null,
      readyServers: inputServerUrl === serverUrl ? [{ id: "server-1", accessUrl: serverUrl }] : [],
      truthQuery:
        inputServerUrl === serverUrl
          ? {
              data: {
                generation: "gen-1",
                primaryTransport: "ws",
                candidates: [
                  {
                    transport: "ws",
                    addr: bootstrapAddr,
                    priority: 50,
                  },
                ],
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

    __setP2PSessionDepsForTest({
      createBrowserNode,
      readStoredBootstrapTarget: () => ({}),
      assertBrowserP2PSupport: () => {},
    });

    localStorage.setItem("gomtm:p2p:bootstrap-server-url", serverUrl);

    render(
      <P2PSessionProvider>
        <SessionProbe />
      </P2PSessionProvider>,
    );

    await waitFor(() => {
      expect(screen.getByTestId("status").textContent).toBe("peer_candidates_ready");
    });

    expect(screen.getByTestId("active-bootstrap").textContent).toBe(bootstrapAddr);
    expect(screen.getByTestId("candidate-count").textContent).toBe("0");
    expect(screen.getByTestId("is-connected").textContent).toBe("false");
    expect(screen.getByTestId("can-connect").textContent).toBe("false");
    expect(screen.getByTestId("server-url").textContent).toBe("");
    expect(screen.getByTestId("server-url-input").textContent).toBe("");
    expect(awaitReady).toHaveBeenCalledTimes(1);
  });

  it("returns a transport-neutral bootstrap join error message", () => {
    expect(
      describeBootstrapJoinError({
        bootstrapAddr: "/dns4/p2p.example.com/tcp/443/ws/p2p/12D3KooWBootstrap",
        error: new Error("connection failed"),
      }),
    ).toBe(
      "无法连接到 bootstrap 节点 /dns4/p2p.example.com/tcp/443/ws/p2p/12D3KooWBootstrap，请确认地址可用且当前网络支持该地址所需的传输。",
    );
  });
});
