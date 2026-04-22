// @vitest-environment jsdom

import type { ButtonHTMLAttributes, HTMLAttributes, ReactNode } from "react";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

const readPeerCapabilities = vi.fn();
const getResolvedPeerCapabilities = vi.fn(() => null);
const getResolvedPeerTruth = vi.fn(() => null);
let cachedCapabilities: Array<{ name: string; reason?: string; state?: string }> | null = null;

const runtimeState = {
  activeConnectionAddr: "/dns4/bootstrap.example.com/tcp/443/tls/ws/p2p/12D3KooWBootstrap",
  canConnect: true,
  connect: vi.fn(async () => true),
  currentNode: null,
  debugConnectPhase: "android-host",
  debugLastError: null,
  diagnostics: { runtime_status: "ready" },
  errorMessage: null,
  getResolvedPeerCapabilities: (peerId: string) => {
    void peerId;
    return getResolvedPeerCapabilities(peerId) ?? cachedCapabilities;
  },
  getResolvedPeerTruth,
  hostKind: "android-host" as const,
  isConnected: true,
  peerCandidates: [
    {
      lastDiscoveredAt: "2026-04-21T16:00:00.000Z",
      multiaddrs: ["/dns4/peer.example.com/tcp/443/tls/ws/p2p/12D3KooWPeer"],
      peerId: "12D3KooWPeer",
    },
  ],
  peers: [],
  readPeerCapabilities,
  saveConnection: vi.fn(async () => {}),
  saveServerUrl: vi.fn(async () => {}),
  serverUrl: "https://gomtm.example.com",
  serverUrlInput: "https://gomtm.example.com",
  setServerUrlInput: vi.fn(),
  status: "peer_candidates_ready" as const,
};

vi.mock("next/link", () => ({
  default: ({ children, href, ...props }: { children: ReactNode; href: string } & Record<string, unknown>) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}));

vi.mock("lucide-react", () => ({
  RefreshCw: () => <span aria-hidden="true" />,
}));

vi.mock("@/components/dash-layout", () => ({
  DashHeaders: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  DashContent: ({ children }: { children: ReactNode }) => <div>{children}</div>,
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
  Button: ({ children, ...props }: ButtonHTMLAttributes<HTMLButtonElement>) => <button {...props}>{children}</button>,
}));

vi.mock("mtxuilib/ui/card", () => ({
  Card: ({ children }: { children: ReactNode }) => <section>{children}</section>,
  CardContent: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  CardHeader: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  CardTitle: ({ children, ...props }: HTMLAttributes<HTMLHeadingElement>) => <h2 {...props}>{children}</h2>,
}));

vi.mock("../runtime/p2p-runtime-provider", () => ({
  useP2PRuntime: () => runtimeState,
}));

import { P2PPeerPageView } from "./p2p-peer-page-view";

describe("P2PPeerPageView hard cut", () => {
  afterEach(() => {
    cleanup();
    readPeerCapabilities.mockReset();
    cachedCapabilities = null;
    getResolvedPeerCapabilities.mockReset();
    getResolvedPeerCapabilities.mockReturnValue(null);
    getResolvedPeerTruth.mockReset();
    getResolvedPeerTruth.mockReturnValue(null);
  });

  it("renders generic capability descriptors before diagnostics and removes the Android subpage entry", async () => {
    readPeerCapabilities.mockResolvedValue([
      { name: "android.native_remote_v2_webrtc", reason: "", state: "available" },
      { name: "linux.web_ssh", reason: "not_supported", state: "unavailable" },
    ]);

    render(<P2PPeerPageView peerId="12D3KooWPeer" />);

    await waitFor(() => {
      expect(screen.getByText("linux.web_ssh")).toBeTruthy();
    });

    const capabilityHeading = screen.getByRole("heading", { name: "节点能力" });
    const diagnosticsSummary = screen.getByText("诊断信息");
    expect(Boolean(capabilityHeading.compareDocumentPosition(diagnosticsSummary) & Node.DOCUMENT_POSITION_FOLLOWING)).toBe(true);

    expect(screen.getByText("android.native_remote_v2_webrtc")).toBeTruthy();
    expect(screen.queryByRole("link", { name: "Android" })).toBeNull();
    expect(readPeerCapabilities).toHaveBeenCalledWith("12D3KooWPeer", undefined);
  });

  it("renders cached generic capability descriptors without refetch collapsing them to Android truth", async () => {
    cachedCapabilities = [
      { name: "android.native_remote_v2_webrtc", reason: "", state: "available" },
      { name: "linux.web_ssh", reason: "not_supported", state: "unavailable" },
    ];
    getResolvedPeerTruth.mockReturnValue({
      remoteControl: {
        capabilities: {
          nativeRemoteV2WebRTC: {
            reason: "",
            state: "available",
          },
        },
      },
    });

    render(<P2PPeerPageView peerId="12D3KooWPeer" />);

    await waitFor(() => {
      expect(screen.getByText("linux.web_ssh")).toBeTruthy();
    });

    expect(readPeerCapabilities).not.toHaveBeenCalled();
  });

  it("re-reads capabilities on manual refresh even when cached capability data already exists", async () => {
    cachedCapabilities = [
      { name: "android.native_remote_v2_webrtc", reason: "", state: "available" },
      { name: "linux.web_ssh", reason: "cached", state: "unavailable" },
    ];
    getResolvedPeerTruth.mockReturnValue({
      remoteControl: {
        capabilities: {
          nativeRemoteV2WebRTC: {
            reason: "",
            state: "available",
          },
        },
      },
    });
    readPeerCapabilities.mockResolvedValue([
      { name: "android.native_remote_v2_webrtc", reason: "", state: "available" },
      { name: "linux.web_ssh", reason: "fresh", state: "available" },
    ]);

    render(<P2PPeerPageView peerId="12D3KooWPeer" />);

    await waitFor(() => {
      expect(screen.getByText("linux.web_ssh")).toBeTruthy();
    });

    expect(readPeerCapabilities).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole("button", { name: "刷新能力" }));

    await waitFor(() => {
      expect(readPeerCapabilities).toHaveBeenCalledWith("12D3KooWPeer", { forceRefresh: true });
    });
  });

  it("shows later background-hydrated capabilities after an empty probe without reconnect", async () => {
    readPeerCapabilities.mockResolvedValue([]);

    const rendered = render(<P2PPeerPageView peerId="12D3KooWPeer" />);

    await waitFor(() => {
      expect(screen.getByText("当前没有可展示的节点能力。")).toBeTruthy();
    });

    expect(screen.queryByText("目标节点未返回能力真相。")).toBeNull();

    cachedCapabilities = [
      { name: "android.native_remote_v2_webrtc", reason: "", state: "available" },
      { name: "linux.web_ssh", reason: "not_supported", state: "unavailable" },
    ];

    rendered.rerender(<P2PPeerPageView peerId="12D3KooWPeer" />);

    await waitFor(() => {
      expect(screen.getByText("linux.web_ssh")).toBeTruthy();
    });

    expect(runtimeState.connect).not.toHaveBeenCalled();
  });
});
