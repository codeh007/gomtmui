import { beforeEach, describe, expect, it, vi } from "vitest";

import { hermesApi } from "./api";

describe("hermesApi", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    process.env.NEXT_PUBLIC_GOMTM_SERVER_URL = "https://gomtm2.yuepa8.com";
  });

  it("requests Hermes sessions from the gomtm server without custom credentials overrides", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ sessions: [] }),
    });
    vi.stubGlobal("fetch", fetchMock);

    await hermesApi.getSessions(50, 0);

    expect(fetchMock).toHaveBeenCalledWith(
      "https://gomtm2.yuepa8.com/api/hermes/sessions?limit=50&offset=0",
      expect.objectContaining({ cache: "no-store" }),
    );
  });

  it("surfaces upstream unauthorized responses verbatim", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: false,
      status: 401,
      statusText: "Unauthorized",
      text: async () => '{"detail":"Unauthorized"}',
    });
    vi.stubGlobal("fetch", fetchMock);

    await expect(hermesApi.getSessions(5, 0)).rejects.toThrow(
      '401: {"detail":"Unauthorized"}',
    );
  });
});
