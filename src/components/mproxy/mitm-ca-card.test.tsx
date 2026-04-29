// @vitest-environment jsdom

import type { ButtonHTMLAttributes, ReactNode } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { MitmCaCard } from "./mitm-ca-card";

const useCurrentUserRoleMock = vi.fn();

vi.mock("@/hooks/use-current-user-role", () => ({
  useCurrentUserRole: () => useCurrentUserRoleMock(),
}));

vi.mock("sonner", () => ({
  toast: {
    error: vi.fn(),
    success: vi.fn(),
  },
}));

vi.mock("mtxuilib/ui/button", () => ({
  Button: ({ children, ...props }: ButtonHTMLAttributes<HTMLButtonElement>) => <button {...props}>{children}</button>,
}));

vi.mock("mtxuilib/ui/card", () => ({
  Card: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  CardContent: ({ children, ...props }: React.HTMLAttributes<HTMLDivElement>) => <div {...props}>{children}</div>,
  CardDescription: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  CardHeader: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  CardTitle: ({ children }: { children: ReactNode }) => <div>{children}</div>,
}));

function createCaState(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    download_path: "/api/cf/mproxy/mitm/ca/cert",
    file_name: "gomtm-mitm-ca.crt",
    initialized: true,
    not_after: "2036-01-01T00:00:00.000Z",
    not_before: "2026-01-01T00:00:00.000Z",
    sha256_fingerprint: "a".repeat(64),
    subject_common_name: "Gomtm MITM Proxy CA",
    ...overrides,
  };
}

function renderCard() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });

  return render(
    <QueryClientProvider client={queryClient}>
      <MitmCaCard />
    </QueryClientProvider>,
  );
}

describe("MitmCaCard", () => {
  beforeEach(() => {
    useCurrentUserRoleMock.mockReturnValue({
      isAdmin: true,
      isLoading: false,
    });
    global.fetch = vi.fn().mockResolvedValue({
      json: async () => createCaState(),
      ok: true,
    } as Response);
  });

  afterEach(() => {
    cleanup();
    useCurrentUserRoleMock.mockReset();
    vi.restoreAllMocks();
  });

  it("hides the download link until the CA is initialized", async () => {
    vi.mocked(global.fetch).mockResolvedValueOnce({
      json: async () => createCaState({ initialized: false }),
      ok: true,
    } as Response);

    renderCard();

    await waitFor(() => {
      expect(screen.getByText("未初始化")).toBeTruthy();
    });

    expect(screen.queryByRole("link", { name: "下载根证书" })).toBeNull();
  });

  it("uses the CA state download_path as the single source of truth", async () => {
    vi.mocked(global.fetch).mockResolvedValueOnce({
      json: async () => createCaState({ download_path: "/api/cf/mproxy/mitm/ca/cert?download=1" }),
      ok: true,
    } as Response);

    renderCard();

    await waitFor(() => {
      expect(screen.getByText("已初始化")).toBeTruthy();
    });

    expect(screen.getByText("/api/cf/mproxy/mitm/ca/cert?download=1")).toBeTruthy();
    expect(screen.getByRole("link", { name: "下载根证书" }).getAttribute("href")).toBe("/api/cf/mproxy/mitm/ca/cert?download=1");
  });
});
