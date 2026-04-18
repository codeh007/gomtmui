import { describe, expect, it } from "vitest";
import { rewriteWikiLinks } from "./wiki-links";

describe("rewriteWikiLinks", () => {
  it("rewrites simple wikilinks into internal /wiki routes", () => {
    expect(rewriteWikiLinks("[[foo]]")).toBe("[foo](/wiki/foo)");
  });

  it("rewrites wikilinks with custom labels", () => {
    expect(rewriteWikiLinks("[[foo/bar|显示名]]")).toBe("[显示名](/wiki/foo/bar)");
  });
});
