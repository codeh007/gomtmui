import { afterEach, describe, expect, it, vi } from "vitest";

const fetchMock = vi.fn();
const originalFetch = globalThis.fetch;
const globalWithWindow = globalThis as typeof globalThis & {
  window?: Window & { __HERMES_SESSION_TOKEN__?: string };
};
const originalWindow = globalWithWindow.window;

function mockJsonResponse(payload: unknown, init?: ResponseInit) {
  return new Response(JSON.stringify(payload), {
    headers: {
      "content-type": "application/json",
    },
    status: 200,
    ...init,
  });
}

async function loadHermesApi() {
  return import("./api");
}

describe("hermes api", () => {
  afterEach(() => {
    fetchMock.mockReset();
    vi.resetModules();
    vi.unstubAllEnvs();
    Object.defineProperty(globalThis, "fetch", {
      configurable: true,
      value: originalFetch,
      writable: true,
    });
    if (originalWindow === undefined) {
      delete globalWithWindow.window;
    } else {
      globalWithWindow.window = originalWindow;
    }
  });

  it("injects the embedded Hermes session token for protected requests", async () => {
    vi.stubEnv("NEXT_PUBLIC_GOMTM_SERVER_URL", "https://gomtm.example.com/");
    globalWithWindow.window = {
      __HERMES_SESSION_TOKEN__: "embedded-token",
    } as Window & { __HERMES_SESSION_TOKEN__?: string };
    fetchMock.mockResolvedValue(mockJsonResponse({ sessions: [] }));
    Object.defineProperty(globalThis, "fetch", {
      configurable: true,
      value: fetchMock,
      writable: true,
    });

    const { hermesApi } = await loadHermesApi();

    await hermesApi.getSessions(50, 0);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("https://gomtm.example.com/api/hermes/sessions?limit=50&offset=0");
    expect(init.cache).toBe("no-store");
    expect(new Headers(init.headers).get("Authorization")).toBe("Bearer embedded-token");
  });
});
