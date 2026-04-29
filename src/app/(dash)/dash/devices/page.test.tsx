// @vitest-environment jsdom

import type { HTMLAttributes, ReactNode } from "react";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mockGetUser = vi.fn();
const mockRpc = vi.fn();

vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({
    auth: {
      getUser: mockGetUser,
    },
    rpc: mockRpc,
  }),
}));

vi.mock("@/components/dash-layout", () => ({
  DashHeaders: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  DashContent: ({ children, ...props }: HTMLAttributes<HTMLDivElement>) => <div {...props}>{children}</div>,
}));

vi.mock("mtxuilib/ui/badge", () => ({
  Badge: ({ children, variant = "default" }: { children: ReactNode; variant?: string }) => <span data-testid={`badge-${variant}`}>{children}</span>,
}));

vi.mock("mtxuilib/ui/card", () => ({
  Card: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  CardContent: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  CardHeader: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  CardTitle: ({ children }: { children: ReactNode }) => <div>{children}</div>,
}));

vi.mock("mtxuilib/ui/scroll-area", () => ({
  ScrollArea: ({ children }: { children: ReactNode }) => <div>{children}</div>,
}));

vi.mock("mtxuilib/ui/table", () => ({
  Table: ({ children }: { children: ReactNode }) => <table>{children}</table>,
  TableBody: ({ children }: { children: ReactNode }) => <tbody>{children}</tbody>,
  TableCell: ({ children }: { children: ReactNode }) => <td>{children}</td>,
  TableHead: ({ children }: { children: ReactNode }) => <th>{children}</th>,
  TableHeader: ({ children }: { children: ReactNode }) => <thead>{children}</thead>,
  TableRow: ({ children }: { children: ReactNode }) => <tr>{children}</tr>,
}));

vi.mock("@/components/devices/android-host-activation-card", () => ({
  AndroidHostActivationCard: () => <div>android-host-activation-card</div>,
}));

import DevicesPage from "./page";

async function renderPage() {
  render(await DevicesPage());
}

describe("DevicesPage", () => {
  beforeEach(() => {
    mockGetUser.mockResolvedValue({
      data: {
        user: { id: "user-1" },
      },
      error: null,
    });
    mockRpc.mockResolvedValue({
      data: [
        {
          id: "linux-1",
          created_at: "2026-04-28T00:00:00Z",
          updated_at: "2026-04-28T00:00:00Z",
          name: "CI Linux",
          platform: "linux",
          owner_user_id: "user-1",
          last_seen_at: "2026-04-28T00:00:00Z",
          tags: ["managed"],
          activation_status: "active",
          presence_status: "online",
          runtime_status: "ready",
          last_error: null,
          metadata: {
            hostKind: "linux-host",
          },
        },
        {
          id: "android-1",
          created_at: "2026-04-28T00:00:00Z",
          updated_at: "2026-04-28T00:00:00Z",
          name: "Pixel Host",
          platform: "android",
          owner_user_id: "user-1",
          last_seen_at: null,
          tags: ["android-host"],
          activation_status: "inactive",
          presence_status: "offline",
          runtime_status: "stopped",
          last_error: null,
          metadata: {
            hostKind: "android-host",
            packageName: "com.gomtm.host",
          },
        },
      ],
      error: null,
    });
  });

  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it("presents linux and android as the same managed runtime surface", async () => {
    await renderPage();

    expect(screen.getByText("这里统一展示 Linux 与 Android 受管运行时。配置负责启动运行时，devices 负责证明运行时在线。")).toBeTruthy();
    expect(screen.getByText("受管运行时")).toBeTruthy();
    expect(screen.getByText("Linux")).toBeTruthy();
    expect(screen.getByText("Android")).toBeTruthy();

    expect(screen.getAllByTestId("badge-default").map((node) => node.textContent)).toEqual(
      expect.arrayContaining(["active", "online", "ready"]),
    );
  });
});
