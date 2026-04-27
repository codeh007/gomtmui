import { afterEach, describe, expect, it, vi } from "vitest";

const fetchMock = vi.fn();
const originalFetch = globalThis.fetch;

async function loadServerPeerDirectoryApi() {
  return import("./server-peer-directory-api");
}

function mockJsonResponse(payload: unknown, init?: ResponseInit) {
  return new Response(JSON.stringify(payload), {
    headers: {
      "content-type": "application/json",
    },
    status: 200,
    ...init,
  });
}

describe("server peer directory api", () => {
  afterEach(() => {
    fetchMock.mockReset();
    Object.defineProperty(globalThis, "fetch", {
      configurable: true,
      value: originalFetch,
      writable: true,
    });
  });

  it("fetchServerPeerDirectory requests the gomtm server peer directory endpoint", async () => {
    fetchMock.mockResolvedValue(
      mockJsonResponse({
        peers: [{ peer_id: "12D3KooWPeer", multiaddrs: [], last_seen_at: "2026-04-23T00:00:00Z", source: "server" }],
      }),
    );
    Object.defineProperty(globalThis, "fetch", {
      configurable: true,
      value: fetchMock,
      writable: true,
    });

    const { fetchServerPeerDirectory } = await loadServerPeerDirectoryApi();

    await fetchServerPeerDirectory("https://gomtm.example.com/");

    expect(fetchMock).toHaveBeenCalledWith("https://gomtm.example.com/api/p2p/directory/peers", {
      cache: "no-store",
      credentials: "omit",
      method: "GET",
    });
  });
});
