// @vitest-environment jsdom

import type { ButtonHTMLAttributes, ReactNode } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ConfigListView } from "./config-list-view";

const fetchConfigProfiles = vi.fn();
const fetchStartupCommand = vi.fn();
const toastSuccess = vi.fn();
const toastError = vi.fn();
const pushMock = vi.fn();

vi.mock("@/lib/gomtm-configs/api", () => ({
  fetchConfigProfiles: (...args: unknown[]) => fetchConfigProfiles(...args),
  fetchStartupCommand: (...args: unknown[]) => fetchStartupCommand(...args),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: (...args: unknown[]) => pushMock(...args),
  }),
}));

vi.mock("sonner", () => ({
  toast: {
    success: (...args: unknown[]) => toastSuccess(...args),
    error: (...args: unknown[]) => toastError(...args),
  },
}));

vi.mock("mtxuilib/ui/button", () => ({
  Button: ({ children, ...props }: ButtonHTMLAttributes<HTMLButtonElement>) => <button {...props}>{children}</button>,
}));

vi.mock("mtxuilib/ui/card", () => ({
  Card: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  CardHeader: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  CardTitle: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  CardDescription: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  CardContent: ({ children }: { children: ReactNode }) => <div>{children}</div>,
}));

vi.mock("mtxuilib/ui/table", () => ({
  Table: ({ children }: { children: ReactNode }) => <table>{children}</table>,
  TableHeader: ({ children }: { children: ReactNode }) => <thead>{children}</thead>,
  TableBody: ({ children }: { children: ReactNode }) => <tbody>{children}</tbody>,
  TableRow: ({ children }: { children: ReactNode }) => <tr>{children}</tr>,
  TableHead: ({ children, className }: { children: ReactNode; className?: string }) => <th className={className}>{children}</th>,
  TableCell: ({ children, className }: { children: ReactNode; className?: string }) => <td className={className}>{children}</td>,
}));

describe("ConfigListView", () => {
  function renderView() {
    const queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
        mutations: { retry: false },
      },
    });

    return render(
      <QueryClientProvider client={queryClient}>
        <ConfigListView />
      </QueryClientProvider>,
    );
  }

  afterEach(() => {
    cleanup();
    fetchConfigProfiles.mockReset();
    fetchStartupCommand.mockReset();
    toastSuccess.mockReset();
    toastError.mockReset();
    pushMock.mockReset();
    vi.restoreAllMocks();
  });

  it("shows only current-config columns and copies the startup command", async () => {
    fetchConfigProfiles.mockResolvedValue({
      items: [
        {
          name: "custom1",
          description: "Demo profile",
          updated_at: "2026-04-29T03:00:00Z",
        },
      ],
    });
    fetchStartupCommand.mockResolvedValue({
      command: 'gomtm server --config="https://example.com/api/cf/gomtm/runtime-configs/custom1?sig=abc" --bootstrap-credential="gbr_demo" --device-name="$(hostname)"',
    });

    const writeText = vi.fn().mockResolvedValue(undefined);
    vi.stubGlobal("navigator", {
      clipboard: {
        writeText,
      },
    });

    renderView();

    await screen.findByText("custom1");

    expect(screen.queryByRole("columnheader", { name: "状态" })).toBeNull();
    expect(screen.queryByRole("button", { name: "发布" })).toBeNull();
    expect(screen.getByText("Demo profile")).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "复制启动命令" }));

    await waitFor(() => {
      expect(fetchStartupCommand.mock.calls[0]?.[0]).toBe("custom1");
      expect(writeText).toHaveBeenCalledWith(
        'gomtm server --config="https://example.com/api/cf/gomtm/runtime-configs/custom1?sig=abc" --bootstrap-credential="gbr_demo" --device-name="$(hostname)"',
      );
    });
  });

  it("keeps startup-command copy available for any saved profile", async () => {
    fetchConfigProfiles.mockResolvedValue({
      items: [
        {
          name: "saved-config",
          description: "Saved profile",
          updated_at: "2026-04-29T03:00:00Z",
        },
      ],
    });
    fetchStartupCommand.mockResolvedValue({
      command: 'gomtm server --config="https://example.com/api/cf/gomtm/runtime-configs/saved-config?sig=abc" --bootstrap-credential="gbr_demo" --device-name="$(hostname)"',
    });

    renderView();

    await screen.findByText("saved-config");

    const copyButton = screen.getByRole("button", { name: "复制启动命令" }) as HTMLButtonElement;
    expect(copyButton.disabled).toBe(false);

    fireEvent.click(copyButton);

    await waitFor(() => {
      expect(fetchStartupCommand.mock.calls[0]?.[0]).toBe("saved-config");
    });
  });
});
