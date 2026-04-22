// @vitest-environment jsdom

import type { ButtonHTMLAttributes, HTMLAttributes, ReactNode } from "react";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

const fetchMock = vi.fn();
const originalFetch = globalThis.fetch;

function mockCapabilityResponse(capabilities: Array<{ name: string; reason?: string; state?: string }>) {
  fetchMock.mockResolvedValue(
    new Response(JSON.stringify(capabilities), {
      headers: {
        "content-type": "application/json",
      },
      status: 200,
    }),
  );
}

const runtimeState = {
  activeConnectionAddr: "/dns4/bootstrap.example.com/tcp/443/tls/ws/p2p/12D3KooWBootstrap",
  canConnect: true,
  connect: vi.fn(async () => true),
  currentNode: null,
  debugConnectPhase: "android-host",
  debugLastError: null,
  diagnostics: { runtime_status: "ready" },
  errorMessage: null,
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
    fetchMock.mockReset();
    Object.defineProperty(globalThis, "fetch", {
      configurable: true,
      value: originalFetch,
      writable: true,
    });
  });

  it("renders generic capability descriptors before diagnostics and no longer shows the old capability entrypoint text", async () => {
    mockCapabilityResponse([
      { name: "android.native_remote_v2_webrtc", reason: "", state: "available" },
      { name: "linux.web_ssh", reason: "not_supported", state: "unavailable" },
    ]);

    Object.defineProperty(globalThis, "fetch", {
      configurable: true,
      value: fetchMock,
      writable: true,
    });

    render(<P2PPeerPageView peerId="12D3KooWPeer" />);

    await waitFor(() => {
      expect(screen.getByText("linux.web_ssh")).toBeTruthy();
    });

    const capabilityHeading = screen.getByRole("heading", { name: "节点能力" });
    const diagnosticsSummary = screen.getByText("诊断信息");
    expect(Boolean(capabilityHeading.compareDocumentPosition(diagnosticsSummary) & Node.DOCUMENT_POSITION_FOLLOWING)).toBe(true);

    expect(screen.getByText("android.native_remote_v2_webrtc")).toBeTruthy();
    expect(screen.queryByRole("link", { name: "Android" })).toBeNull();
    expect(screen.queryByText("能力读取入口")).toBeNull();
    expect(fetchMock).toHaveBeenCalledWith(
      "https://gomtm.example.com/api/p2p/peers/12D3KooWPeer/capabilities",
      {
        cache: "no-store",
        credentials: "omit",
        method: "GET",
      },
    );
  });

  it("re-reads capabilities from the gomtm server operator api on manual refresh", async () => {
    fetchMock
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify([
            { name: "android.native_remote_v2_webrtc", reason: "", state: "available" },
            { name: "linux.web_ssh", reason: "cached", state: "unavailable" },
          ]),
          {
            headers: {
              "content-type": "application/json",
            },
            status: 200,
          },
        ),
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify([
            { name: "android.native_remote_v2_webrtc", reason: "", state: "available" },
            { name: "linux.web_ssh", reason: "fresh", state: "available" },
          ]),
          {
            headers: {
              "content-type": "application/json",
            },
            status: 200,
          },
        ),
      );

    Object.defineProperty(globalThis, "fetch", {
      configurable: true,
      value: fetchMock,
      writable: true,
    });

    render(<P2PPeerPageView peerId="12D3KooWPeer" />);

    await waitFor(() => {
      expect(screen.getByText("linux.web_ssh")).toBeTruthy();
    });

    fireEvent.click(screen.getByRole("button", { name: "刷新能力" }));

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledTimes(2);
    });
  });

  it("renders an open remote link when android.native_remote_v2 is available", async () => {
    mockCapabilityResponse([{ name: "android.native_remote_v2", reason: "ready", state: "available" }]);

    Object.defineProperty(globalThis, "fetch", {
      configurable: true,
      value: fetchMock,
      writable: true,
    });

    render(<P2PPeerPageView peerId="12D3KooWPeer" />);

    const remoteLink = await screen.findByRole("link", { name: "打开远控" });

    expect(remoteLink.getAttribute("href")).toBe("/dash/p2p/12D3KooWPeer/remote");
  });
});
