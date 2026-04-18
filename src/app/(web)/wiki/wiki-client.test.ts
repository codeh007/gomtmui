import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fetchWikiPage } from "./wiki-client";

describe("fetchWikiPage", () => {
  const originalFetch = global.fetch;

  beforeEach(() => {
    process.env.GOMTM_SERVER_URL = "https://gomtm2.yuepa8.com";
    global.fetch = vi.fn(async (input: RequestInfo | URL) => {
      return new Response(JSON.stringify({ ok: true, url: String(input) }), { status: 200 });
    }) as typeof fetch;
  });

  afterEach(() => {
    global.fetch = originalFetch;
    delete process.env.GOMTM_SERVER_URL;
  });

  it("encodes decoded slug segments once", async () => {
    await fetchWikiPage(["queries", "gomtm-wiki-在线化方案最小结论"]);
    expect(global.fetch).toHaveBeenCalledWith(
      "https://gomtm2.yuepa8.com/api/wiki/page/queries/gomtm-wiki-%E5%9C%A8%E7%BA%BF%E5%8C%96%E6%96%B9%E6%A1%88%E6%9C%80%E5%B0%8F%E7%BB%93%E8%AE%BA",
      { cache: "no-store" },
    );
  });

  it("does not double encode already encoded slug segments", async () => {
    await fetchWikiPage(["queries", "gomtm-wiki-%E5%9C%A8%E7%BA%BF%E5%8C%96%E6%96%B9%E6%A1%88%E6%9C%80%E5%B0%8F%E7%BB%93%E8%AE%BA"]);
    expect(global.fetch).toHaveBeenCalledWith(
      "https://gomtm2.yuepa8.com/api/wiki/page/queries/gomtm-wiki-%E5%9C%A8%E7%BA%BF%E5%8C%96%E6%96%B9%E6%A1%88%E6%9C%80%E5%B0%8F%E7%BB%93%E8%AE%BA",
      { cache: "no-store" },
    );
  });

  it("adapts bare wiki slugs to backend concept paths", async () => {
    await fetchWikiPage(["9router-的-cloudflare-worker-与-vercel-适配边界结论"]);
    expect(global.fetch).toHaveBeenCalledWith(
      "https://gomtm2.yuepa8.com/api/wiki/page/concepts/9router-%E7%9A%84-cloudflare-worker-%E4%B8%8E-vercel-%E9%80%82%E9%85%8D%E8%BE%B9%E7%95%8C%E7%BB%93%E8%AE%BA",
      { cache: "no-store" },
    );
  });
});
