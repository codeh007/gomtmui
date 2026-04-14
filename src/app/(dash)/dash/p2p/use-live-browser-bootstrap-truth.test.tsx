// @vitest-environment jsdom

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@/components/server-instance/hooks", () => ({
  useServerInstanceListInfinite: vi.fn(() => ({ data: undefined })),
}));

import {
  __resetLiveBootstrapDepsForTest,
  __setLiveBootstrapDepsForTest,
  LiveBootstrapProbe,
} from "./use-live-browser-bootstrap-truth";

afterEach(() => {
  cleanup();
  __resetLiveBootstrapDepsForTest();
  vi.restoreAllMocks();
});

function createTestQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
      },
    },
  });
}

describe("useLiveBrowserBootstrapTruth", () => {
  it("fetches live truth from the first ready server access url instead of gomtmui route", async () => {
    const fetchMock = vi.fn(async () => ({
      browser_bootstrap_truth: {
        generation: "gen-1",
        primary_transport: "webtransport",
        candidates: [
          {
            transport: "webtransport",
            addr: "/dns4/p2p.example.com/udp/8443/quic-v1/webtransport/certhash/uEiFresh/p2p/12D3KooWBootstrap",
            priority: 100,
          },
        ],
      },
    }));

    __setLiveBootstrapDepsForTest({
      fetchJson: fetchMock,
      useReadyServers: () => [{ id: "server-1", accessUrl: "https://srv.example.com" }],
    });

    render(
      <QueryClientProvider client={createTestQueryClient()}>
        <LiveBootstrapProbe />
      </QueryClientProvider>,
    );

    await waitFor(() => {
      expect(screen.getByTestId("live-bootstrap-state").textContent).toBe("success");
    });

    expect(fetchMock).toHaveBeenCalledWith("https://srv.example.com/api/system/status");
    expect(fetchMock).not.toHaveBeenCalledWith("/api/system/status");
  });
});
