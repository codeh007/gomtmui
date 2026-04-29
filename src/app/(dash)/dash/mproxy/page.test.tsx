// @vitest-environment jsdom

import type { ReactNode } from "react";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import MProxyPage from "./page";

vi.mock("@/components/dash-layout", () => ({
  DashHeaders: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  DashContent: ({ children }: { children: ReactNode }) => <div>{children}</div>,
}));

vi.mock("@/components/common/error-boundary", () => ({
  ErrorBoundary: ({ children }: { children: ReactNode }) => <div>{children}</div>,
}));

vi.mock("@/components/mproxy/extract-records-card", () => ({
  ExtractRecordsCard: () => <div>ExtractRecordsCard</div>,
}));

vi.mock("@/components/mproxy/mitm-ca-card", () => ({
  MitmCaCard: () => <div>MitmCaCard</div>,
}));

vi.mock("@/components/mproxy/node-pool-card", () => ({
  NodePoolCard: () => <div>NodePoolCard</div>,
}));

vi.mock("@/components/mproxy/subscription-import-card", () => ({
  SubscriptionImportCard: () => <div>SubscriptionImportCard</div>,
}));

vi.mock("@/components/mproxy/schemas", () => ({
  readStoredProxyEndpoint: () => "",
  writeStoredProxyEndpoint: vi.fn(),
}));

vi.mock("@/lib/gomtm-server/provider", () => ({
  useGomtmServer: () => ({
    defaultServerUrl: "https://gomtm.example.com",
    serverUrl: "",
  }),
}));

describe("MProxyPage", () => {
  afterEach(() => {
    cleanup();
  });

  it("describes vmess output using current runtime config language", () => {
    render(<MProxyPage />);

    expect(screen.getByText(/当前运行配置/)).toBeTruthy();
    expect(screen.queryByText(/已发布 runtime config/)).toBeNull();
  });
});
