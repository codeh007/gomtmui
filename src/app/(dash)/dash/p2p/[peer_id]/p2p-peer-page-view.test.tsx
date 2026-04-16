// @vitest-environment jsdom

import { cleanup, render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, describe, expect, test, vi } from "vitest";
import { P2PPeerPageView } from "./p2p-peer-page-view";

vi.mock("next/link", () => ({
  default: ({ children, href }: { children: ReactNode; href: string }) => <a href={href}>{children}</a>,
}));

vi.mock("@/components/dash-layout", () => ({
  DashContent: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  DashHeaders: ({ children }: { children: ReactNode }) => <div>{children}</div>,
}));

vi.mock("@/lib/p2p/discovery-contracts", () => ({
  getPeerDisplayTitle: () => "测试节点",
}));

vi.mock("mtxuilib/ui/alert", () => ({
  Alert: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  AlertDescription: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  AlertTitle: ({ children }: { children: ReactNode }) => <div>{children}</div>,
}));

vi.mock("mtxuilib/ui/badge", () => ({
  Badge: ({ children }: { children: ReactNode }) => <span>{children}</span>,
}));

vi.mock("mtxuilib/ui/breadcrumb", () => ({
  Breadcrumb: ({ children }: { children: ReactNode }) => <nav>{children}</nav>,
  BreadcrumbItem: ({ children }: { children: ReactNode }) => <span>{children}</span>,
  BreadcrumbLink: ({ children, href }: { children: ReactNode; href: string }) => <a href={href}>{children}</a>,
  BreadcrumbList: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  BreadcrumbPage: ({ children }: { children: ReactNode }) => <span>{children}</span>,
  BreadcrumbSeparator: () => <span>/</span>,
}));

vi.mock("mtxuilib/ui/button", () => ({
  Button: ({ children, ...props }: { children: ReactNode } & Record<string, unknown>) => <button {...props}>{children}</button>,
}));

vi.mock("mtxuilib/ui/card", () => ({
  Card: ({ children }: { children: ReactNode }) => <section>{children}</section>,
  CardContent: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  CardHeader: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  CardTitle: ({ children }: { children: ReactNode }) => <h2>{children}</h2>,
}));

vi.mock("mtxuilib/ui/input", () => ({
  Input: (props: Record<string, unknown>) => <input {...props} />,
}));

vi.mock("../use-p2p-session", () => ({
  getP2PStatusMeta: () => ({ label: "已连接", tone: "default" }),
}));

vi.mock("./use-p2p-peer-page-session", () => ({
  useP2PPeerPageSession: () => ({
    activeBootstrapAddr: "/dns4/p2p.example.com/udp/8443/quic-v1/webtransport/certhash/uEiTest/p2p/12D3KooWBootstrap",
    bootstrapInput: "/dns4/p2p.example.com/udp/8443/quic-v1/webtransport/certhash/uEiTest/p2p/12D3KooWBootstrap",
    canConnect: true,
    canOpenAndroid: true,
    canOpenVnc: false,
    capabilityTruth: {
      remoteControl: {
        platform: "android",
        capabilities: {
          nativeRemoteV2: { state: "available" },
          nativeRemoteV2WebRTC: { state: "available" },
        },
        session: {
          controllerMode: "single_controller",
          controllerState: "idle",
        },
      },
      vnc: { state: "unavailable" },
    },
    connect: vi.fn(async () => true),
    errorMessage: null,
    featureLabels: ["android"],
    isConnected: true,
    peerId: "12D3KooWPeer",
    peerTruthErrorMessage: null,
    peerTruthStatus: "ready",
    refreshPeerTruth: vi.fn(),
    setBootstrapInput: vi.fn(),
    status: "peer_candidates_ready",
    targetPeer: {
      lastDiscoveredAt: "2026-04-15T18:00:00Z",
      multiaddrs: ["/ip4/127.0.0.1/tcp/4101/p2p/12D3KooWPeer"],
      peerId: "12D3KooWPeer",
    },
    visibleMultiaddrs: ["/ip4/127.0.0.1/tcp/4101/p2p/12D3KooWPeer"],
  }),
}));

describe("P2PPeerPageView", () => {
  afterEach(() => {
    cleanup();
  });

  test("android 概览不再展示 adb_tunnel 状态块", () => {
    render(<P2PPeerPageView peerId="12D3KooWPeer" />);

    expect(screen.getByText("native_remote_v2")).toBeTruthy();
    expect(screen.getByText("native_remote_v2_webrtc")).toBeTruthy();
    expect(screen.queryByText("adb_tunnel")).toBeNull();
  });
});
