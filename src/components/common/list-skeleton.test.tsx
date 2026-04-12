import { cleanup, render } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { CardSkeleton, ChatSkeleton, ListSkeleton, TableSkeleton } from "./list-skeleton";

afterEach(() => {
  cleanup();
});

describe("Skeletons", () => {
  it("ListSkeleton renders the correct number of items", () => {
    const { container } = render(<ListSkeleton count={3} />);
    const items = container.querySelectorAll(".animate-in");
    expect(items.length).toBe(3);
  });

  it("ListSkeleton supports toggling media representation", () => {
    const { container: withMedia } = render(<ListSkeleton count={1} showMedia={true} />);
    const mediaNodeWith = withMedia.querySelector(".rounded-full");
    expect(mediaNodeWith).not.toBeNull();

    const { container: withoutMedia } = render(<ListSkeleton count={1} showMedia={false} />);
    const mediaNodeWithout = withoutMedia.querySelector(".rounded-full");
    expect(mediaNodeWithout).toBeNull();
  });

  it("CardSkeleton renders correctly", () => {
    const { container } = render(<CardSkeleton />);
    const cards = container.querySelectorAll(".bg-card");
    expect(cards.length).toBe(1);
  });

  it("TableSkeleton renders correct rows and cols", () => {
    const { container } = render(<TableSkeleton rows={2} cols={3} />);
    // Initial row for headers plus 2 rows
    const rows = container.querySelectorAll(".border-b");
    expect(rows.length).toBe(3);
  });

  it("ChatSkeleton renders correctly", () => {
    const { container } = render(<ChatSkeleton count={2} />);
    const dots = container.querySelectorAll(".rounded-full");
    expect(dots.length).toBe(2);
  });
});
