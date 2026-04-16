// @vitest-environment jsdom

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

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
  it("probes well-known bootstrap metadata from direct live origins instead of server instance rpc", async () => {
    const fetchMock = vi.fn(async () => ({
      version: 1,
      server: {
        public_url: "https://gomtm2.yuepa8.com",
      },
      p2p: {
        enabled: true,
        generation: "gen-1",
        browser: {
          generation: "gen-1",
          primary_transport: "webtransport",
          candidates: [
            {
              transport: "webtransport",
              addr: "/dns4/gomtm2.yuepa8.com/udp/8443/quic-v1/webtransport/certhash/uEiFresh/p2p/12D3KooWBootstrap",
              priority: 100,
            },
          ],
        },
      },
    }));

    __setLiveBootstrapDepsForTest({
      fetchJson: fetchMock,
      getCandidateOrigins: () => ["https://gomtm2.yuepa8.com"],
    });

    render(
      <QueryClientProvider client={createTestQueryClient()}>
        <LiveBootstrapProbe />
      </QueryClientProvider>,
    );

    await waitFor(() => {
      expect(screen.getByTestId("live-bootstrap-state").textContent).toBe("success");
    });

    expect(fetchMock).toHaveBeenCalledWith("https://gomtm2.yuepa8.com/.well-known/gomtm-bootstrap");
  });
});
