// @vitest-environment jsdom

import type { ButtonHTMLAttributes, ReactNode } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ConfigListView } from "./config-list-view";

const fetchConfigProfiles = vi.fn();
const fetchStartupCommand = vi.fn();
const publishConfigProfile = vi.fn();
const toastSuccess = vi.fn();
const toastError = vi.fn();
const pushMock = vi.fn();

vi.mock("@/lib/gomtm-configs/api", () => ({
  fetchConfigProfiles: (...args: unknown[]) => fetchConfigProfiles(...args),
  fetchStartupCommand: (...args: unknown[]) => fetchStartupCommand(...args),
  publishConfigProfile: (...args: unknown[]) => publishConfigProfile(...args),
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

vi.mock("mtxuilib/ui/badge", () => ({
  Badge: ({ children }: { children: ReactNode }) => <span>{children}</span>,
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
    publishConfigProfile.mockReset();
    toastSuccess.mockReset();
    toastError.mockReset();
    pushMock.mockReset();
    vi.restoreAllMocks();
  });

  it("shows lifecycle-focused columns and copies the startup command", async () => {
    fetchConfigProfiles.mockResolvedValue({
      items: [
        {
          name: "custom1",
          description: "Demo profile",
          target_kind: "linux",
          status: "published",
          current_version: 3,
          published_version: 2,
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

    expect(screen.queryByRole("columnheader", { name: "目标" })).toBeNull();
    expect(screen.queryByRole("columnheader", { name: "Published" })).toBeNull();
    expect(screen.getByText("Demo profile")).toBeTruthy();
    expect(screen.queryByText("Demo profile · linux")).toBeNull();
    expect(screen.queryByText("linux")).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: "复制启动命令" }));

    await waitFor(() => {
      expect(fetchStartupCommand.mock.calls[0]?.[0]).toBe("custom1");
      expect(writeText).toHaveBeenCalledWith(
        'gomtm server --config="https://example.com/api/cf/gomtm/runtime-configs/custom1?sig=abc" --bootstrap-credential="gbr_demo" --device-name="$(hostname)"',
      );
    });
  });

  it("disables startup-command copy for draft profiles", async () => {
    fetchConfigProfiles.mockResolvedValue({
      items: [
        {
          name: "draft-config",
          description: "Draft profile",
          target_kind: "linux",
          status: "draft",
          current_version: 3,
          published_version: null,
          updated_at: "2026-04-29T03:00:00Z",
        },
      ],
    });

    renderView();

    await screen.findByText("draft-config");

    const copyButton = screen.getByRole("button", { name: "复制启动命令" }) as HTMLButtonElement;
    expect(copyButton.disabled).toBe(true);

    fireEvent.click(copyButton);
    expect(fetchStartupCommand).not.toHaveBeenCalled();
  });
});
