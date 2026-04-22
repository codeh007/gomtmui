// @vitest-environment jsdom

import type { ButtonHTMLAttributes, InputHTMLAttributes, ReactNode } from "react";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

const runtimeState = {
  hostKind: "browser",
  currentNode: {
    peerId: "12D3KooWSelf",
    multiaddrs: ["/dns4/self.example.com/tcp/443/tls/ws/p2p/12D3KooWSelf"],
  },
  peers: [
    {
      peerId: "12D3KooWPeer",
      multiaddrs: ["/dns4/peer.example.com/tcp/443/tls/ws/p2p/12D3KooWPeer"],
      discoveredAt: "2026-04-21T00:00:00Z",
    },
  ],
  status: "peer_candidates_ready",
  diagnostics: {},
  readPeerCapabilities: vi.fn(),
  saveConnection: vi.fn(),
  activeConnectionAddr: "",
  canConnect: true,
  connect: vi.fn(),
  debugConnectPhase: "discovering",
  debugLastError: null,
  errorMessage: null,
  getResolvedPeerTruth: () => ({
    remoteControl: {
      capabilities: {
        nativeRemoteV2WebRTC: {
          state: "available",
        },
      },
    },
  }),
  isConnected: true,
  peerCandidates: [
    {
      peerId: "12D3KooWPeer",
      multiaddrs: ["/dns4/peer.example.com/tcp/443/tls/ws/p2p/12D3KooWPeer"],
      lastDiscoveredAt: "2026-04-21T00:00:00Z",
    },
  ],
  saveServerUrl: vi.fn(),
  serverUrl: "https://gomtm.example.com",
  serverUrlInput: "https://gomtm.example.com",
  setServerUrlInput: vi.fn(),
};

vi.mock("next/link", () => ({
  default: ({ children, href, ...props }: { children: ReactNode; href: string } & Record<string, unknown>) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn() }),
}));

vi.mock("@/components/dash-layout", () => ({
  DashHeaders: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  DashContent: ({ children }: { children: ReactNode }) => <div>{children}</div>,
}));

vi.mock("mtxuilib/ui/badge", () => ({
  Badge: ({ children }: { children: ReactNode }) => <span>{children}</span>,
}));

vi.mock("mtxuilib/ui/button", () => ({
  Button: ({ children, ...props }: ButtonHTMLAttributes<HTMLButtonElement>) => <button {...props}>{children}</button>,
}));

vi.mock("mtxuilib/ui/card", () => ({
  Card: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  CardContent: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  CardHeader: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  CardTitle: ({ children }: { children: ReactNode }) => <div>{children}</div>,
}));

vi.mock("mtxuilib/ui/dialog", () => ({
  Dialog: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  DialogContent: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  DialogDescription: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  DialogHeader: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  DialogTitle: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  DialogTrigger: ({ children }: { children: ReactNode }) => <div>{children}</div>,
}));

vi.mock("mtxuilib/ui/dropdown-menu", () => ({
  DropdownMenu: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  DropdownMenuContent: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  DropdownMenuItem: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  DropdownMenuTrigger: ({ children }: { children: ReactNode }) => <div>{children}</div>,
}));

vi.mock("mtxuilib/ui/input", () => ({
  Input: (props: InputHTMLAttributes<HTMLInputElement>) => <input {...props} />,
}));

vi.mock("mtxuilib/ui/item", () => ({
  Item: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  ItemActions: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  ItemContent: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  ItemGroup: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  ItemMedia: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  ItemTitle: ({ children }: { children: ReactNode }) => <div>{children}</div>,
}));

vi.mock("mtxuilib/ui/popover", () => ({
  Popover: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  PopoverContent: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  PopoverTrigger: ({ children }: { children: ReactNode }) => <div>{children}</div>,
}));

vi.mock("./runtime/p2p-runtime-provider", () => ({
  useP2PRuntime: () => runtimeState,
}));

import P2PPage from "./page";

describe("P2PPage hard cut", () => {
  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it("shows current node first and routes discovered peers to the unified detail page", () => {
    render(<P2PPage />);

    const currentNodeHeading = screen.getByRole("heading", { name: "当前节点" });
    const discoveredPeersHeading = screen.getByRole("heading", { name: "发现节点" });
    expect(Boolean(currentNodeHeading.compareDocumentPosition(discoveredPeersHeading) & Node.DOCUMENT_POSITION_FOLLOWING)).toBe(
      true,
    );

    expect(screen.getByText("12D3KooWSelf")).toBeTruthy();

    const detailLink = screen.getByRole("link", { name: "查看节点 12D3KooWPeer" });
    expect(detailLink.getAttribute("href")).toBe("/dash/p2p/12D3KooWPeer");

    expect(screen.queryByRole("link", { name: "Android" })).toBeNull();
  });
});
