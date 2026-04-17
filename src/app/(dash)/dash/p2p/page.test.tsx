// @vitest-environment jsdom

import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn() }),
}));

vi.mock("@/components/dash-layout", () => ({
  DashHeaders: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  DashContent: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

vi.mock("mtxuilib/ui/badge", () => ({
  Badge: ({ children }: { children: React.ReactNode }) => <span>{children}</span>,
}));
vi.mock("mtxuilib/ui/button", () => ({
  Button: ({ children, ...props }: React.ButtonHTMLAttributes<HTMLButtonElement>) => <button {...props}>{children}</button>,
}));
vi.mock("mtxuilib/ui/card", () => ({
  Card: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  CardContent: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  CardHeader: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  CardTitle: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));
vi.mock("mtxuilib/ui/dialog", () => ({
  Dialog: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  DialogContent: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  DialogDescription: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  DialogHeader: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  DialogTitle: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  DialogTrigger: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));
vi.mock("mtxuilib/ui/dropdown-menu", () => ({
  DropdownMenu: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  DropdownMenuContent: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  DropdownMenuItem: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  DropdownMenuTrigger: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));
vi.mock("mtxuilib/ui/input", () => ({
  Input: (props: React.InputHTMLAttributes<HTMLInputElement>) => <input {...props} />,
}));
vi.mock("mtxuilib/ui/item", () => ({
  Item: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  ItemActions: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  ItemContent: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  ItemGroup: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  ItemMedia: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  ItemTitle: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));
vi.mock("mtxuilib/ui/popover", () => ({
  Popover: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  PopoverContent: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  PopoverTrigger: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));
vi.mock("./use-live-browser-connection-truth", () => ({
  useLiveBrowserConnectionTruth: () => ({
    accessUrl: null,
    readyServers: [],
    truthQuery: {
      data: null,
      status: "success",
      error: null,
    },
  }),
}));

import P2PPage from "./page";
import { P2PSessionProvider } from "./use-p2p-session";

describe("P2PPage server-url-only UI", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  afterEach(() => {
    cleanup();
  });

  it("默认网络面板不再暴露旧连接入口与高级连接 UI", async () => {
    render(
      <P2PSessionProvider>
        <P2PPage />
      </P2PSessionProvider>,
    );

    await waitFor(() => {
      expect(screen.getByRole("button", { name: "网络状态：等待后端地址" })).toBeTruthy();
    });

    screen.getByRole("button", { name: "网络状态：等待后端地址" }).click();

    expect(await screen.findByText("后端地址")).toBeTruthy();
    expect(screen.getByPlaceholderText("gomtm server 公网地址，例如 https://gomtm2.yuepa8.com")).toBeTruthy();
    expect(screen.getByRole("button", { name: "保存并连接" })).toBeTruthy();

    expect(screen.queryByText("当前 BOOTSTRAP")).toBeNull();
    expect(screen.queryByPlaceholderText("高级：手工覆盖浏览器可拨 multiaddr（WebTransport/WSS）")).toBeNull();
    expect(screen.queryByRole("button", { name: "高级连接" })).toBeNull();
    expect(screen.queryByText("入网路径=未知")).toBeNull();
  });
});
