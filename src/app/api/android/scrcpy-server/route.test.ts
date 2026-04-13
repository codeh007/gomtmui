import { afterEach, describe, expect, it, vi } from "vitest";

import { GET, resolveUpstreamScrcpyServerURL } from "./route";

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("resolveUpstreamScrcpyServerURL", () => {
  it("builds the official scrcpy release download URL", () => {
    expect(resolveUpstreamScrcpyServerURL("3.3.3")).toBe(
      "https://github.com/Genymobile/scrcpy/releases/download/v3.3.3/scrcpy-server-v3.3.3",
    );
  });
});

describe("GET", () => {
  it("proxies the official upstream scrcpy server asset through same-origin route", async () => {
    const upstreamResponse = new Response(new Uint8Array([1, 2, 3]), {
      headers: {
        "content-type": "application/octet-stream",
      },
      status: 200,
    });
    const fetchMock = vi.fn(async () => upstreamResponse);
    vi.stubGlobal("fetch", fetchMock);

    const response = await GET(new Request("https://gomtmui-dev.yuepa8.com/api/android/scrcpy-server?v=3.3.3"));

    expect(fetchMock).toHaveBeenCalledWith(
      "https://github.com/Genymobile/scrcpy/releases/download/v3.3.3/scrcpy-server-v3.3.3",
      expect.objectContaining({ redirect: "follow" }),
    );
    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toBe("application/octet-stream");
    expect(Array.from(new Uint8Array(await response.arrayBuffer()))).toEqual([1, 2, 3]);
  });
});
