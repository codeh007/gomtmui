// @vitest-environment jsdom

import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { notFound } = vi.hoisted(() => ({
  notFound: vi.fn(() => {
    throw new Error("NEXT_NOT_FOUND");
  }),
}));

vi.mock("next/navigation", () => ({
  notFound,
}));

vi.mock("@/components/site/site-header", () => ({
  SiteHeader: () => <div data-testid="site-header">header</div>,
}));

vi.mock("./wiki-client", () => ({
  fetchWikiPage: vi.fn(),
}));

import { fetchWikiPage } from "./wiki-client";
import WikiPage from "./[[...slug]]/page";

describe("WikiPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders markdown returned by the gomtm wiki api", async () => {
    vi.mocked(fetchWikiPage).mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        title: "Wiki Home",
        path: "/wiki",
        sourcePath: "wiki/index.md",
        markdown: "# 首页\n\n[[foo|进入 Foo]]\n",
        frontmatter: {
          updated: "2026-04-18",
        },
        kind: "index",
      }),
    } as Response);

    const element = await WikiPage({ params: Promise.resolve({}) });
    render(element);

    expect(screen.getByRole("heading", { name: "首页" })).toBeTruthy();
    expect(screen.getByRole("link", { name: "进入 Foo" }).getAttribute("href")).toBe("/wiki/foo");
    expect(screen.getByText("wiki/index.md")).toBeTruthy();
  });

  it("delegates missing pages to next notFound", async () => {
    vi.mocked(fetchWikiPage).mockResolvedValue({
      ok: false,
      status: 404,
    } as Response);

    await expect(WikiPage({ params: Promise.resolve({ slug: ["missing"] }) })).rejects.toThrow("NEXT_NOT_FOUND");
    expect(notFound).toHaveBeenCalledTimes(1);
  });
});
