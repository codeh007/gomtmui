import { afterEach, describe, expect, it, vi } from "vitest";

const fetchMock = vi.fn();
const originalFetch = globalThis.fetch;

async function loadServerPeerOperatorApi() {
  const modulePath = "./server-peer-operator-api";
  return import(modulePath);
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

describe("server peer operator api", () => {
  afterEach(() => {
    fetchMock.mockReset();
    Object.defineProperty(globalThis, "fetch", {
      configurable: true,
      value: originalFetch,
      writable: true,
    });
  });

  it("fetchServerPeerCapabilities requests the gomtm server capabilities endpoint with GET no-store and omit credentials", async () => {
    fetchMock.mockResolvedValue(
      mockJsonResponse([{ name: "android.native_remote_v2_webrtc", reason: "ready", state: "available" }]),
    );
    Object.defineProperty(globalThis, "fetch", {
      configurable: true,
      value: fetchMock,
      writable: true,
    });

    const { fetchServerPeerCapabilities } = await loadServerPeerOperatorApi();

    await fetchServerPeerCapabilities({
      peerId: "12D3KooWPeer",
      serverUrl: "https://gomtm.example.com/",
    });

    expect(fetchMock).toHaveBeenCalledWith(
      "https://gomtm.example.com/api/p2p/peers/12D3KooWPeer/capabilities",
      {
        cache: "no-store",
        credentials: "omit",
        method: "GET",
      },
    );
  });

  it("postServerPeerRemoteCommand posts a JSON body to the gomtm server remote control command endpoint", async () => {
    fetchMock.mockResolvedValue(mockJsonResponse({ ok: true }));
    Object.defineProperty(globalThis, "fetch", {
      configurable: true,
      value: fetchMock,
      writable: true,
    });

    const { postServerPeerRemoteCommand } = await loadServerPeerOperatorApi();

    await postServerPeerRemoteCommand({
      command: "screen.tap",
      params: { x: 12, y: 34 },
      peerId: "12D3KooWPeer",
      serverUrl: "https://gomtm.example.com",
    });

    expect(fetchMock).toHaveBeenCalledWith(
      "https://gomtm.example.com/api/p2p/peers/12D3KooWPeer/remote_control/commands",
      {
        body: JSON.stringify({
          command: "screen.tap",
          params: { x: 12, y: 34 },
        }),
        cache: "no-store",
        credentials: "omit",
        headers: {
          "content-type": "application/json",
        },
        method: "POST",
      },
    );
  });
});
