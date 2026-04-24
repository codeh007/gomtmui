// @vitest-environment jsdom

import { createElement, Fragment } from "react";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { useServerShellRuntime } from "@/app/(dash)/dash/p2p/runtime/use-server-shell-runtime";
import { fetchServerSelfNode } from "./server-self-node-api";

const fetchMock = vi.fn();
const originalFetch = globalThis.fetch;

function jsonResponse(payload: unknown, init?: ResponseInit) {
  return new Response(JSON.stringify(payload), {
    headers: {
      "content-type": "application/json",
    },
    status: 200,
    ...init,
  });
}

function ServerShellProbe() {
  const runtime = useServerShellRuntime();

  return createElement(
    Fragment,
    null,
    createElement("div", { "data-testid": "shell-kind" }, runtime.shellKind),
    createElement("div", { "data-testid": "status" }, runtime.status),
    createElement("div", { "data-testid": "current-peer-id" }, runtime.currentNode?.peerId ?? ""),
    createElement("div", { "data-testid": "peer-ids" }, runtime.peers.map((peer) => peer.peerId).join(",")),
    createElement("div", { "data-testid": "peer-count" }, String(runtime.peers.length)),
    createElement("div", { "data-testid": "error-message" }, runtime.errorMessage ?? ""),
  );
}

describe("fetchServerSelfNode", () => {
  afterEach(() => {
    cleanup();
    fetchMock.mockReset();
    window.localStorage.clear();
    Object.defineProperty(globalThis, "fetch", {
      configurable: true,
      value: originalFetch,
      writable: true,
    });
  });

  it("loads the canonical server self node truth", async () => {
    fetchMock.mockResolvedValue(
      jsonResponse({
        node: {
          peer_id: "12D3KooWServer",
          platform: "linux",
          connection_addr: "/dns4/gomtm2.yuepa8.com/tcp/443/tls/ws/p2p/12D3KooWServer",
          runtime_status: "connected",
        },
      }),
    );

    vi.stubGlobal("fetch", fetchMock);

    await expect(fetchServerSelfNode("https://gomtm2.yuepa8.com")).resolves.toEqual({
      peerId: "12D3KooWServer",
      platform: "linux",
      connectionAddr: "/dns4/gomtm2.yuepa8.com/tcp/443/tls/ws/p2p/12D3KooWServer",
      runtimeStatus: "connected",
    });
  });

  it("fails closed when peer_id is missing from self truth", async () => {
    fetchMock.mockResolvedValue(
      jsonResponse({
        node: {
          platform: "linux",
          connection_addr: "/dns4/gomtm2.yuepa8.com/tcp/443/tls/ws/p2p/12D3KooWServer",
          runtime_status: "connected",
        },
      }),
    );

    vi.stubGlobal("fetch", fetchMock);

    await expect(fetchServerSelfNode("https://gomtm2.yuepa8.com")).rejects.toThrow("gomtm server self node truth 缺少有效 peer_id。");
  });

  it("fails closed when peer_id is empty in self truth", async () => {
    fetchMock.mockResolvedValue(
      jsonResponse({
        node: {
          peer_id: "   ",
          platform: "linux",
          connection_addr: "/dns4/gomtm2.yuepa8.com/tcp/443/tls/ws/p2p/12D3KooWServer",
          runtime_status: "connected",
        },
      }),
    );

    vi.stubGlobal("fetch", fetchMock);

    await expect(fetchServerSelfNode("https://gomtm2.yuepa8.com")).rejects.toThrow("gomtm server self node truth 缺少有效 peer_id。");
  });

  it("does not accept camelCase fallback fields from non-canonical self truth", async () => {
    fetchMock.mockResolvedValue(
      jsonResponse({
        node: {
          peerId: "12D3KooWServer",
          platform: "linux",
          connectionAddr: "/dns4/gomtm2.yuepa8.com/tcp/443/tls/ws/p2p/12D3KooWServer",
          runtimeStatus: "connected",
        },
      }),
    );

    vi.stubGlobal("fetch", fetchMock);

    await expect(fetchServerSelfNode("https://gomtm2.yuepa8.com")).rejects.toThrow("gomtm server self node truth 缺少有效 peer_id。");
  });
});

describe("useServerShellRuntime", () => {
  afterEach(() => {
    cleanup();
    fetchMock.mockReset();
    window.localStorage.clear();
    Object.defineProperty(globalThis, "fetch", {
      configurable: true,
      value: originalFetch,
      writable: true,
    });
  });

  it("reads only server self truth and peer directory for the server shell", async () => {
    window.localStorage.setItem("gomtm:p2p:server-url", "https://gomtm2.yuepa8.com");

    fetchMock.mockImplementation(async (input: RequestInfo | URL) => {
      if (input === "https://gomtm2.yuepa8.com/api/p2p/self") {
        return jsonResponse({
          node: {
            peer_id: "12D3KooWServer",
            platform: "linux",
            connection_addr: "/dns4/gomtm2.yuepa8.com/tcp/443/tls/ws/p2p/12D3KooWServer",
            runtime_status: "connected",
          },
        });
      }

      if (input === "https://gomtm2.yuepa8.com/api/p2p/directory/peers") {
        return jsonResponse({
          peers: [
            {
              peer_id: "12D3KooWServer",
              multiaddrs: ["/dns4/gomtm2.yuepa8.com/tcp/443/tls/ws/p2p/12D3KooWServer"],
              last_seen_at: "2026-04-23T00:00:00Z",
            },
            {
              peer_id: "12D3KooWPeer",
              multiaddrs: ["/dns4/peer.example.com/tcp/443/tls/ws/p2p/12D3KooWPeer"],
              last_seen_at: "2026-04-23T00:00:00Z",
            },
          ],
        });
      }

      throw new Error(`Unexpected fetch input: ${String(input)}`);
    });

    vi.stubGlobal("fetch", fetchMock);

    render(createElement(ServerShellProbe));

    await waitFor(() => {
      expect(screen.getByTestId("status").textContent).toBe("peer_candidates_ready");
    });

    expect(screen.getByTestId("shell-kind").textContent).toBe("server-shell");
    expect(screen.getByTestId("current-peer-id").textContent).toBe("12D3KooWServer");
    expect(screen.getByTestId("peer-ids").textContent).toBe("12D3KooWPeer");
    expect(screen.getByTestId("peer-count").textContent).toBe("1");
    expect(screen.getByTestId("error-message").textContent).toBe("");
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(fetchMock).toHaveBeenCalledWith("https://gomtm2.yuepa8.com/api/p2p/self", {
      cache: "no-store",
      credentials: "omit",
      method: "GET",
    });
    expect(fetchMock).toHaveBeenCalledWith("https://gomtm2.yuepa8.com/api/p2p/directory/peers", {
      cache: "no-store",
      credentials: "omit",
      method: "GET",
    });
  });

  it("errors when server self truth is missing and does not fall back to browser truth", async () => {
    window.localStorage.setItem("gomtm:p2p:server-url", "https://gomtm2.yuepa8.com");

    fetchMock.mockImplementation(async (input: RequestInfo | URL) => {
      if (input === "https://gomtm2.yuepa8.com/api/p2p/self") {
        return jsonResponse({});
      }

      if (input === "https://gomtm2.yuepa8.com/api/p2p/directory/peers") {
        return jsonResponse({
          peers: [
            {
              peer_id: "12D3KooWPeer",
              multiaddrs: ["/dns4/peer.example.com/tcp/443/tls/ws/p2p/12D3KooWPeer"],
              last_seen_at: "2026-04-23T00:00:00Z",
            },
          ],
        });
      }

      throw new Error(`Unexpected fetch input: ${String(input)}`);
    });

    vi.stubGlobal("fetch", fetchMock);

    render(createElement(ServerShellProbe));

    await waitFor(() => {
      expect(screen.getByTestId("status").textContent).toBe("error");
    });

    expect(screen.getByTestId("current-peer-id").textContent).toBe("");
    expect(screen.getByTestId("peer-count").textContent).toBe("0");
    expect(screen.getByTestId("error-message").textContent).toBe("gomtm server 未返回 self node truth。");
  });

  it("fails closed when self truth is malformed and never reports ready without currentNode", async () => {
    window.localStorage.setItem("gomtm:p2p:server-url", "https://gomtm2.yuepa8.com");

    fetchMock.mockImplementation(async (input: RequestInfo | URL) => {
      if (input === "https://gomtm2.yuepa8.com/api/p2p/self") {
        return jsonResponse({
          node: {
            peer_id: "",
            platform: "linux",
            connection_addr: "/dns4/gomtm2.yuepa8.com/tcp/443/tls/ws/p2p/12D3KooWServer",
            runtime_status: "connected",
          },
        });
      }

      if (input === "https://gomtm2.yuepa8.com/api/p2p/directory/peers") {
        return jsonResponse({
          peers: [
            {
              peer_id: "12D3KooWPeer",
              multiaddrs: ["/dns4/peer.example.com/tcp/443/tls/ws/p2p/12D3KooWPeer"],
              last_seen_at: "2026-04-23T00:00:00Z",
            },
          ],
        });
      }

      throw new Error(`Unexpected fetch input: ${String(input)}`);
    });

    vi.stubGlobal("fetch", fetchMock);

    render(createElement(ServerShellProbe));

    await waitFor(() => {
      expect(screen.getByTestId("status").textContent).toBe("error");
    });

    expect(screen.getByTestId("current-peer-id").textContent).toBe("");
    expect(screen.getByTestId("peer-count").textContent).toBe("0");
    expect(screen.getByTestId("error-message").textContent).toBe("gomtm server self node truth 缺少有效 peer_id。");
  });
});
