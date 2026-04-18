import { describe, expect, it } from "vitest";
import { resolveWikiApiSlug, rewriteWikiLinks } from "./wiki-links";

describe("rewriteWikiLinks", () => {
  it("rewrites simple wikilinks into internal /wiki routes", () => {
    expect(rewriteWikiLinks("[[foo]]")).toBe("[foo](/wiki/foo)");
  });

  it("rewrites wikilinks with custom labels", () => {
    expect(rewriteWikiLinks("[[foo/bar|显示名]]")).toBe("[显示名](/wiki/foo/bar)");
  });
});

describe("resolveWikiApiSlug", () => {
  it("keeps canonical section-prefixed slugs unchanged", () => {
    expect(resolveWikiApiSlug(["queries", "gomtm-wiki-在线化方案最小结论"])).toEqual(["queries", "gomtm-wiki-在线化方案最小结论"]);
  });

  it("maps bare wikilink slugs to concepts so frontend adapts to backend layout", () => {
    expect(resolveWikiApiSlug(["9router-的-cloudflare-worker-与-vercel-适配边界结论"])).toEqual([
      "concepts",
      "9router-的-cloudflare-worker-与-vercel-适配边界结论",
    ]);
  });

  it("decodes encoded segments before applying section fallback", () => {
    expect(resolveWikiApiSlug(["9router-%E7%9A%84-cloudflare-worker-%E4%B8%8E-vercel-%E9%80%82%E9%85%8D%E8%BE%B9%E7%95%8C%E7%BB%93%E8%AE%BA"])).toEqual([
      "concepts",
      "9router-的-cloudflare-worker-与-vercel-适配边界结论",
    ]);
  });
});
