// @vitest-environment jsdom

import type { ReactNode } from "react";
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("next/link", () => ({
  default: ({ children, href, ...props }: { children: ReactNode; href: string } & Record<string, unknown>) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}));

vi.mock("lucide-react", () => ({
  ChevronLeft: () => <span aria-hidden="true" />,
}));

vi.mock("@/components/dash-layout", () => ({
  DashContent: ({ children }: { children: ReactNode }) => <div>{children}</div>,
}));

vi.mock("mtxuilib/lib/utils", () => ({
  cn: (...values: Array<string | false | null | undefined>) => values.filter(Boolean).join(" "),
}));

vi.mock("mtxuilib/ui/alert", () => ({
  Alert: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  AlertDescription: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  AlertTitle: ({ children }: { children: ReactNode }) => <div>{children}</div>,
}));

vi.mock("mtxuilib/ui/badge", () => ({
  Badge: ({ children }: { children: ReactNode }) => <span>{children}</span>,
}));

vi.mock("mtxuilib/ui/button", () => ({
  Button: ({ children }: { children: ReactNode }) => <button>{children}</button>,
}));
import { getP2PConnectionEntryMeta, P2PConnectionEntryCard } from "./p2p-remote-page-shell";

describe("p2p remote page shell hard cut", () => {
  it("does not mention legacy direct-runtime or join-flow language in connection entry copy", () => {
    expect(getP2PConnectionEntryMeta("loading").title).toBe("准备节点状态");
    expect(getP2PConnectionEntryMeta("loading").detail).not.toContain("浏览器节点");

    const errorMeta = getP2PConnectionEntryMeta("error");
    expect(errorMeta.detail).not.toContain("主页面已建立的服务器会话");
    expect(errorMeta.detail).not.toContain("连接状态");
  });

  it("renders current node addresses without legacy connection-entry wording", () => {
    render(
      <P2PConnectionEntryCard
        currentNodeAddrs={["/dns4/device.example.com/tcp/443/wss/p2p/12D3KooWDevice"]}
        entryLabel="远程控制"
        onBackToP2P="/dash/p2p"
        status="error"
        surfaceError={null}
      />,
    );

    expect(screen.getByText("当前节点地址")).toBeTruthy();
    expect(screen.queryByText("当前连接入口")).toBeNull();
  });
});
