     // @vitest-environment jsdom
     
     import { cleanup, render, screen, waitFor } from "@testing-library/react";
     import { afterEach, describe, expect, it, vi } from "vitest";
     import {
       __resetP2PSessionDepsForTest,
       __setP2PSessionDepsForTest,
       describeConnectionEntryError,
       P2PSessionProvider,
      useP2PSession,
    } from "./use-p2p-session";
    
    const originalFetch = globalThis.fetch;
    
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
      const session = useP2PSession();
    
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
      __resetP2PSessionDepsForTest();
      vi.restoreAllMocks();
      globalThis.fetch = originalFetch;
    });
    
    describe("P2PSessionProvider", () => {
      it("does not request system status when no local connection state is stored", async () => {
        const fetchMock = vi.fn();
        globalThis.fetch = fetchMock as typeof globalThis.fetch;
    
        vi.mocked(useLiveBrowserConnectionTruth).mockReturnValue({
          accessUrl: null,
          readyServers: [],
          truthQuery: {
            data: null,
            status: "success",
            error: null,
          },
        } as ReturnType<typeof useLiveBrowserConnectionTruth>);
    
        __setP2PSessionDepsForTest({});
    
        render(
          <P2PSessionProvider>
            <SessionProbe />
          </P2PSessionProvider>,
        );
    
        await waitFor(() => {
          expect(screen.getByTestId("status").textContent).toBe("needs-server-url");
        });
    
        expect(fetchMock).not.toHaveBeenCalled();
      });
    
      it("uses live connection truth as default entry when local storage is empty", async () => {
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
                  multiaddrs: ["/dns4/android.example.com/tcp/443/tls/ws/p2p/12D3KooWPeer"],
                  peerId: "12D3KooWPeer",
                },
              ]),
           },
         },
       }));
   
       const serverUrl = "https://gomtm2.yuepa8.com";
       const connectionAddr = "/dns4/gomtm2.yuepa8.com/tcp/443/tls/ws/p2p/12D3KooWBootstrap";
   
       vi.mocked(useLiveBrowserConnectionTruth).mockImplementation((inputServerUrl: string) => ({
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
                       addr: connectionAddr,
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
       }) as ReturnType<typeof useLiveBrowserConnectionTruth>);
   
       __setP2PSessionDepsForTest({
         createBrowserNode,
         assertBrowserP2PSupport: () => {},
       });
   
       localStorage.setItem("gomtm:p2p:server-url", serverUrl);
   
       render(
         <P2PSessionProvider>
           <SessionProbe />
         </P2PSessionProvider>,
       );
   
       await waitFor(() => {
         expect(screen.getByTestId("status").textContent).toBe("peer_candidates_ready");
       });
   
       expect(screen.getByTestId("active-connection").textContent).toBe(connectionAddr);
       expect(screen.getByTestId("candidate-count").textContent).toBe("1");
       expect(screen.getByTestId("is-connected").textContent).toBe("true");
       expect(screen.getByTestId("can-connect").textContent).toBe("true");
       expect(screen.getByTestId("server-url").textContent).toBe(serverUrl);
       expect(screen.getByTestId("server-url-input").textContent).toBe(serverUrl);
       expect(createBrowserNode).toHaveBeenCalledWith({
         connectionAddr,
         transport: "ws",
       });
     });
   
      it("passes ws connection target to createBrowserNode", async () => {
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
       const connectionAddr = "/dns4/p2p.example.com/tcp/443/tls/ws/p2p/12D3KooWBootstrap";
   
       vi.mocked(useLiveBrowserConnectionTruth).mockImplementation((inputServerUrl: string) => ({
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
                       addr: connectionAddr,
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
       }) as ReturnType<typeof useLiveBrowserConnectionTruth>);
   
       __setP2PSessionDepsForTest({
         createBrowserNode,
       });
   
       localStorage.setItem("gomtm:p2p:server-url", serverUrl);
   
       render(
         <P2PSessionProvider>
           <SessionProbe />
         </P2PSessionProvider>,
       );
   
       await waitFor(() => {
         expect(screen.getByTestId("status").textContent).toBe("peer_candidates_ready");
       });
   
       expect(screen.getByTestId("active-connection").textContent).toBe(connectionAddr);
       expect(screen.getByTestId("is-connected").textContent).toBe("true");
       expect(screen.getByTestId("can-connect").textContent).toBe("true");
       expect(screen.getByTestId("server-url").textContent).toBe(serverUrl);
       expect(screen.getByTestId("server-url-input").textContent).toBe(serverUrl);
        expect(createBrowserNode).toHaveBeenCalledWith({
          connectionAddr,
          transport: "ws",
        });
      });

      it("keeps the same auto-connect attempt alive across joining rerenders", async () => {
        const start = vi.fn(async () => {});
        const stop = vi.fn(async () => {});
        const awaitReady = vi.fn(async () => {});
        const listPeerCandidates = vi.fn(async () => []);
        const addEventListener = vi.fn();
        const removeEventListener = vi.fn();
        const createBrowserNode = vi.fn(async () => {
          await new Promise((resolve) => setTimeout(resolve, 0));
          return {
            status: "started" as const,
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
          };
        });

        const serverUrl = "https://gomtm2.yuepa8.com";
        const connectionAddr = "/dns4/gomtm2.yuepa8.com/tcp/443/tls/ws/p2p/12D3KooWBootstrap";

        vi.mocked(useLiveBrowserConnectionTruth).mockImplementation((inputServerUrl: string) => ({
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
                        addr: connectionAddr,
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
        }) as ReturnType<typeof useLiveBrowserConnectionTruth>);

        __setP2PSessionDepsForTest({
          createBrowserNode,
          assertBrowserP2PSupport: () => {},
        });

        localStorage.setItem("gomtm:p2p:server-url", serverUrl);

        render(
          <P2PSessionProvider>
            <SessionProbe />
          </P2PSessionProvider>,
        );

        await waitFor(() => {
          expect(screen.getByTestId("status").textContent).toBe("peer_candidates_ready");
        });

        expect(screen.getByTestId("active-connection").textContent).toBe(connectionAddr);
        expect(screen.getByTestId("candidate-count").textContent).toBe("0");
        expect(screen.getByTestId("is-connected").textContent).toBe("true");
        expect(screen.getByTestId("can-connect").textContent).toBe("true");
        expect(awaitReady).toHaveBeenCalledTimes(1);
        expect(stop).not.toHaveBeenCalled();
      });

      it("keeps the existing connected session when live connection truth errors", async () => {
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
        const connectionAddr = "/dns4/gomtm2.yuepa8.com/tcp/443/tls/ws/p2p/12D3KooWBootstrap";
        let currentTruth: ReturnType<typeof useLiveBrowserConnectionTruth> = {
          accessUrl: serverUrl,
          readyServers: [{ id: "server-1", accessUrl: serverUrl }],
          truthQuery: {
            data: {
              generation: "gen-1",
              primaryTransport: "ws",
              candidates: [
                {
                  transport: "ws",
                  addr: connectionAddr,
                  priority: 50,
                },
              ],
            },
            status: "success",
            error: null,
          },
        } as ReturnType<typeof useLiveBrowserConnectionTruth>;

        vi.mocked(useLiveBrowserConnectionTruth).mockImplementation(() => currentTruth);

        __setP2PSessionDepsForTest({
          createBrowserNode,
          assertBrowserP2PSupport: () => {},
        });

        localStorage.setItem("gomtm:p2p:server-url", serverUrl);

        const view = render(
          <P2PSessionProvider>
            <SessionProbe />
          </P2PSessionProvider>,
        );

        await waitFor(() => {
          expect(screen.getByTestId("status").textContent).toBe("peer_candidates_ready");
        });

        currentTruth = {
          accessUrl: serverUrl,
          readyServers: [{ id: "server-1", accessUrl: serverUrl }],
          truthQuery: {
            data: null,
            status: "error",
            error: new Error("temporary truth failure"),
          },
        } as ReturnType<typeof useLiveBrowserConnectionTruth>;

        view.rerender(
          <P2PSessionProvider>
            <SessionProbe />
          </P2PSessionProvider>,
        );

        await waitFor(() => {
          expect(screen.getByTestId("status").textContent).toBe("peer_candidates_ready");
        });

        expect(screen.getByTestId("active-connection").textContent).toBe(connectionAddr);
        expect(screen.getByTestId("candidate-count").textContent).toBe("0");
        expect(screen.getByTestId("is-connected").textContent).toBe("true");
        expect(screen.getByTestId("can-connect").textContent).toBe("true");
        expect(screen.getByTestId("error-message").textContent).toBe("");
        expect(stop).not.toHaveBeenCalled();
      });

      it("ignores legacy stored connection target and only resumes from stored serverUrl", async () => {
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
       const connectionAddr = "/dns4/gomtm2.yuepa8.com/tcp/443/tls/ws/p2p/12D3KooWBootstrap";
   
       vi.mocked(useLiveBrowserConnectionTruth).mockImplementation((inputServerUrl: string) => ({
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
                       addr: connectionAddr,
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
       }) as ReturnType<typeof useLiveBrowserConnectionTruth>);
   
       __setP2PSessionDepsForTest({
         createBrowserNode,
       });
   
       localStorage.setItem("gomtm:p2p:connection-runtime", JSON.stringify({
         connectionAddr: "/dns4/legacy.example.com/tcp/443/tls/ws/p2p/12D3KooWLegacy",
       }));
       localStorage.setItem("gomtm:p2p:server-url", serverUrl);
   
       render(
         <P2PSessionProvider>
           <SessionProbe />
         </P2PSessionProvider>,
       );
   
       await waitFor(() => {
         expect(screen.getByTestId("status").textContent).toBe("peer_candidates_ready");
       });
   
       expect(createBrowserNode).toHaveBeenCalledWith({
         connectionAddr,
         transport: "ws",
       });
       expect(screen.getByTestId("active-connection").textContent).toBe(connectionAddr);
     });
   
     it("keeps joining with resolving-node when browser node creation never resolves", async () => {
      let resolveCreate: ((value: {
        status: "started";
        start: ReturnType<typeof vi.fn>;
        stop: ReturnType<typeof vi.fn>;
        addEventListener: ReturnType<typeof vi.fn>;
        removeEventListener: ReturnType<typeof vi.fn>;
        services: {
          rendezvousDiscovery: {
            awaitReady: ReturnType<typeof vi.fn>;
            listPeerCandidates: ReturnType<typeof vi.fn>;
          };
        };
      }) => void) | null = null;
      const createBrowserNode = vi.fn(
        () =>
          new Promise((resolve) => {
            resolveCreate = resolve;
          }),
      );

      const serverUrl = "https://gomtm2.yuepa8.com";
      const connectionAddr = "/dns4/gomtm2.yuepa8.com/tcp/443/tls/ws/p2p/12D3KooWBootstrap";

      vi.mocked(useLiveBrowserConnectionTruth).mockImplementation((inputServerUrl: string) => ({
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
                      addr: connectionAddr,
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
      }) as ReturnType<typeof useLiveBrowserConnectionTruth>);

      __setP2PSessionDepsForTest({
        createBrowserNode,
        assertBrowserP2PSupport: () => {},
      });

      localStorage.setItem("gomtm:p2p:server-url", serverUrl);

      render(
        <P2PSessionProvider>
          <SessionProbe />
        </P2PSessionProvider>,
      );

      await waitFor(() => {
        expect(createBrowserNode).toHaveBeenCalledWith({
          connectionAddr,
          transport: "ws",
        });
      });

      await waitFor(() => {
        expect(screen.getByTestId("status").textContent).toBe("joining");
      });

      expect(screen.getByTestId("active-connection").textContent).toBe("");
      expect(screen.getByTestId("candidate-count").textContent).toBe("0");
      expect(screen.getByTestId("is-connected").textContent).toBe("false");
      expect(screen.getByTestId("can-connect").textContent).toBe("false");
      expect(resolveCreate).not.toBeNull();
    });

    it("surfaces awaiting-rendezvous-ready when discovery readiness never resolves", async () => {
      const start = vi.fn(async () => {});
      const stop = vi.fn(async () => {});
      const awaitReady = vi.fn(() => new Promise<void>(() => {}));
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
      const connectionAddr = "/dns4/gomtm2.yuepa8.com/tcp/443/tls/ws/p2p/12D3KooWBootstrap";

      vi.mocked(useLiveBrowserConnectionTruth).mockImplementation((inputServerUrl: string) => ({
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
                      addr: connectionAddr,
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
      }) as ReturnType<typeof useLiveBrowserConnectionTruth>);

      __setP2PSessionDepsForTest({
        createBrowserNode,
        assertBrowserP2PSupport: () => {},
      });

      localStorage.setItem("gomtm:p2p:server-url", serverUrl);

      render(
        <P2PSessionProvider>
          <SessionProbe />
        </P2PSessionProvider>,
      );

      await waitFor(() => {
        expect(createBrowserNode).toHaveBeenCalledWith({
          connectionAddr,
          transport: "ws",
        });
      });

      await waitFor(() => {
        expect(awaitReady).toHaveBeenCalledTimes(1);
      });

      expect(screen.getByTestId("status").textContent).toBe("joining");
      expect(screen.getByTestId("active-connection").textContent).toBe("");
      expect(screen.getByTestId("candidate-count").textContent).toBe("0");
      expect(screen.getByTestId("is-connected").textContent).toBe("false");
      expect(screen.getByTestId("can-connect").textContent).toBe("false");
    });

    it("stays in joining when connection success never commits discovery state", async () => {
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
       const connectionAddr = "/dns4/gomtm2.yuepa8.com/tcp/443/tls/ws/p2p/12D3KooWBootstrap";
   
       vi.mocked(useLiveBrowserConnectionTruth).mockImplementation((inputServerUrl: string) => ({
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
                       addr: connectionAddr,
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
       }) as ReturnType<typeof useLiveBrowserConnectionTruth>);
   
       __setP2PSessionDepsForTest({
         createBrowserNode,
         assertBrowserP2PSupport: () => {},
       });
   
       localStorage.setItem("gomtm:p2p:server-url", serverUrl);
   
       render(
         <P2PSessionProvider>
           <SessionProbe />
         </P2PSessionProvider>,
       );
   
       await waitFor(() => {
         expect(screen.getByTestId("status").textContent).toBe("peer_candidates_ready");
       });
   
       expect(screen.getByTestId("active-connection").textContent).toBe(connectionAddr);
       expect(screen.getByTestId("candidate-count").textContent).toBe("0");
       expect(screen.getByTestId("is-connected").textContent).toBe("true");
       expect(screen.getByTestId("can-connect").textContent).toBe("true");
       expect(screen.getByTestId("server-url").textContent).toBe(serverUrl);
       expect(screen.getByTestId("server-url-input").textContent).toBe(serverUrl);
       expect(awaitReady).toHaveBeenCalledTimes(1);
     });
   
     it("returns a transport-neutral connection entry error message", () => {
       expect(
         describeConnectionEntryError({
           connectionAddr: "/dns4/p2p.example.com/tcp/443/tls/ws/p2p/12D3KooWBootstrap",
           error: new Error("connection failed"),
         }),
       ).toBe(
         "无法连接到 连接入口 /dns4/p2p.example.com/tcp/443/tls/ws/p2p/12D3KooWBootstrap，请确认地址可用且当前网络支持该地址所需的传输。",
       );
     });
   });
   
