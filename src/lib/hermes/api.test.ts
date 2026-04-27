// @vitest-environment jsdom

import { afterEach, describe, expect, it, vi } from "vitest";

type HermesApiModule = typeof import("./api") & {
  createHermesApi: (baseUrl: string) => {
    getStatus: () => Promise<unknown>;
    revealEnvVar: (key: string) => Promise<unknown>;
  };
  fetchHermesSessionDetail: (baseUrl: string, sessionId: string) => Promise<unknown>;
};

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

describe("Hermes API base URL routing", () => {
  afterEach(() => {
    fetchMock.mockReset();
    vi.unstubAllGlobals();
    Object.defineProperty(globalThis, "fetch", {
      configurable: true,
      value: originalFetch,
      writable: true,
    });
    delete window.__HERMES_SESSION_TOKEN__;
  });

  it("sends Hermes status requests to the selected server /api/hermes path", async () => {
    fetchMock.mockResolvedValue(jsonResponse({ ok: true }));
    vi.stubGlobal("fetch", fetchMock);

    const apiModule = (await import("./api")) as HermesApiModule;
    expect(apiModule).toHaveProperty("createHermesApi");

    const hermesApi = apiModule.createHermesApi("https://selected.example.com");
    await hermesApi.getStatus();

    expect(fetchMock).toHaveBeenCalledWith("https://selected.example.com/api/hermes/status", expect.any(Object));
  });

  it("keeps injecting X-Hermes-Session-Token for protected /api/hermes requests", async () => {
    fetchMock.mockResolvedValue(jsonResponse({ key: "OPENAI_API_KEY", value: "secret" }));
    vi.stubGlobal("fetch", fetchMock);
    window.__HERMES_SESSION_TOKEN__ = "session-token-123";

    const apiModule = (await import("./api")) as HermesApiModule;
    expect(apiModule).toHaveProperty("createHermesApi");

    const hermesApi = apiModule.createHermesApi("https://selected.example.com");
    await hermesApi.revealEnvVar("OPENAI_API_KEY");

    expect(fetchMock).toHaveBeenCalledTimes(1);

    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("https://selected.example.com/api/hermes/env/reveal");
    expect(new Headers(init.headers).get("X-Hermes-Session-Token")).toBe("session-token-123");
  });

  it("routes ad-hoc session detail lookups through the selected server /api/hermes path", async () => {
    fetchMock.mockResolvedValue(jsonResponse({ id: "session-123" }));
    vi.stubGlobal("fetch", fetchMock);

    const apiModule = (await import("./api")) as HermesApiModule;
    expect(apiModule).toHaveProperty("fetchHermesSessionDetail");

    await apiModule.fetchHermesSessionDetail("https://selected.example.com", "session-123");

    expect(fetchMock).toHaveBeenCalledWith(
      "https://selected.example.com/api/hermes/sessions/session-123",
      expect.any(Object),
    );
  });

  it("fails fast when no valid gomtm server URL exists", async () => {
    const apiModule = (await import("./api")) as HermesApiModule;

    expect(() => apiModule.createHermesApi("")).toThrow(
      "Hermes API requires a valid gomtm server URL.",
    );
    expect(() => apiModule.createHermesApi("not-a-url")).toThrow(
      "Hermes API requires a valid gomtm server URL.",
    );
  });
});
