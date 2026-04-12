import { cleanup, render, screen } from "@testing-library/react";
import type { ComponentPropsWithoutRef } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("mtxuilib/ui/button", () => ({
  Button: ({ children, ...props }: ComponentPropsWithoutRef<"button">) => <button {...props}>{children}</button>,
}));

import { ErrorBoundary } from "./error-boundary";

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

// Mock console.error to prevent it from cluttering the test output
vi.spyOn(console, "error").mockImplementation(() => {});

function ProblematicComponent({ text }: { text: string }) {
  if (text === "throw") {
    throw new Error("Test error triggered");
  }
  return <div>{text}</div>;
}

describe("ErrorBoundary", () => {
  it("renders children when there is no error", () => {
    render(
      <ErrorBoundary name="TestBoundary">
        <div>Safe Content</div>
      </ErrorBoundary>,
    );
    expect(screen.getByText("Safe Content")).toBeTruthy();
  });

  it("catches errors and displays fallback UI", () => {
    render(
      <ErrorBoundary name="TestBoundary">
        <ProblematicComponent text="throw" />
      </ErrorBoundary>,
    );
    expect(screen.getAllByText("Failed to render component")[0]).toBeTruthy();
    expect(screen.getAllByText("[TestBoundary]")[0]).toBeTruthy();
    expect(screen.getAllByText("Test error triggered")[0]).toBeTruthy();
  });

  it("renders custom fallback if provided", () => {
    render(
      <ErrorBoundary fallback={<div data-testid="custom-fallback">Custom Error</div>}>
        <ProblematicComponent text="throw" />
      </ErrorBoundary>,
    );
    expect(screen.queryAllByText("Failed to render component").length).toBe(0);
    expect(screen.queryAllByTestId("custom-fallback")[0]).toBeTruthy();
  });
});
