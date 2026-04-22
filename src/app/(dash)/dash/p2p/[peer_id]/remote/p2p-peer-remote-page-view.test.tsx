// @vitest-environment jsdom

import type { ButtonHTMLAttributes, ReactNode } from "react";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

const { useP2PPeerRemotePageSession } = vi.hoisted(() => ({
  useP2PPeerRemotePageSession: vi.fn(),
}));

vi.mock("next/link", () => ({
  default: ({ children, href, ...props }: { children: ReactNode; href: string } & Record<string, unknown>) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}));

vi.mock("lucide-react", () => ({
  ChevronLeft: () => <span aria-hidden="true" />,
  Home: () => <span aria-hidden="true" />,
  RefreshCw: () => <span aria-hidden="true" />,
  Undo2: () => <span aria-hidden="true" />,
}));

vi.mock("mtxuilib/ui/alert", () => ({
  Alert: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  AlertDescription: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  AlertTitle: ({ children }: { children: ReactNode }) => <div>{children}</div>,
}));

vi.mock("mtxuilib/ui/button", () => ({
  Button: ({ children, ...props }: ButtonHTMLAttributes<HTMLButtonElement>) => <button {...props}>{children}</button>,
}));

vi.mock("../../runtime/p2p-runtime-contract", () => ({
  getP2PStatusMeta: () => ({ label: "节点发现已就绪", tone: "default" }),
}));

vi.mock("../p2p-remote-page-shell", () => ({
  P2PRemotePageScaffold: ({ children }: { children: ReactNode }) => <div>{children}</div>,
}));

vi.mock("./use-p2p-peer-remote-page-session", () => ({
  useP2PPeerRemotePageSession,
}));

import { P2PPeerRemotePageView } from "./p2p-peer-remote-page-view";

function createSession(overrides?: Record<string, unknown>) {
  return {
    activeConnectionAddr: "/dns4/bootstrap.example.com/tcp/443/tls/ws/p2p/12D3KooWBootstrap",
    busy: false,
    diagnostics: { runtime_status: "ready" },
    errorMessage: null,
    isConnected: true,
    peerId: "12D3KooWPeer",
    sendBack: vi.fn(async () => {}),
    sendHome: vi.fn(async () => {}),
    serverUrl: "https://gomtm.example.com",
    snapshotDataUrl: null,
    status: "peer_candidates_ready",
    ...overrides,
  };
}

describe("P2PPeerRemotePageView", () => {
  afterEach(() => {
    cleanup();
    useP2PPeerRemotePageSession.mockReset();
  });

  it("renders home and back controls", () => {
    useP2PPeerRemotePageSession.mockReturnValue(createSession());

    render(<P2PPeerRemotePageView peerId="12D3KooWPeer" />);

    expect(screen.getByRole("button", { name: "HOME" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "返回" })).toBeTruthy();
  });

  it("renders the screenshot when present or a placeholder when absent", () => {
    useP2PPeerRemotePageSession.mockReturnValueOnce(
      createSession({ snapshotDataUrl: "data:image/png;base64,c25hcHNob3Q=" }),
    );

    const rendered = render(<P2PPeerRemotePageView peerId="12D3KooWPeer" />);

    expect(screen.getByRole("img", { name: "远控截图" }).getAttribute("src")).toBe(
      "data:image/png;base64,c25hcHNob3Q=",
    );

    useP2PPeerRemotePageSession.mockReturnValueOnce(createSession({ snapshotDataUrl: null }));
    rendered.rerender(<P2PPeerRemotePageView peerId="12D3KooWPeer" />);

    expect(screen.getByText("等待截图")).toBeTruthy();
  });
});
