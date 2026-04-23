import { afterEach, describe, expect, it, vi } from "vitest";

const fetchMock = vi.fn();
const originalFetch = globalThis.fetch;

async function loadSessionTokenModule() {
  return import("./session-token");
}

describe("Hermes session token", () => {
  afterEach(() => {
    fetchMock.mockReset();
    vi.resetModules();
    vi.unstubAllEnvs();
    Object.defineProperty(globalThis, "fetch", {
      configurable: true,
      value: originalFetch,
      writable: true,
    });
  });

  it("extracts the injected Hermes dashboard session token from HTML", async () => {
    const { extractHermesSessionToken } = await loadSessionTokenModule();

    expect(
      extractHermesSessionToken(
        '<html><head><script>window.__HERMES_SESSION_TOKEN__="embedded-token";</script></head></html>',
      ),
    ).toBe("embedded-token");
    expect(extractHermesSessionToken("<html><head></head><body></body></html>")).toBeNull();
  });

  it("loads the session token from the mounted Hermes dashboard root page", async () => {
    vi.stubEnv("GOMTM_SERVER_URL", "https://gomtm.example.com/");
    fetchMock.mockResolvedValue(
      new Response('<script>window.__HERMES_SESSION_TOKEN__="embedded-token";</script>', {
        headers: {
          "content-type": "text/html",
        },
        status: 200,
      }),
    );
    Object.defineProperty(globalThis, "fetch", {
      configurable: true,
      value: fetchMock,
      writable: true,
    });

    const { loadHermesSessionToken } = await loadSessionTokenModule();

    await expect(loadHermesSessionToken()).resolves.toBe("embedded-token");

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("https://gomtm.example.com/api/hermes");
    expect(init.cache).toBe("no-store");
    expect(new Headers(init.headers).get("accept")).toBe("text/html");
  });
});
