// @vitest-environment jsdom

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import {
  __resetLiveConnectionDepsForTest,
  __setLiveConnectionDepsForTest,
  LiveConnectionProbe,
} from "./use-live-browser-connection-truth";

afterEach(() => {
  cleanup();
  __resetLiveConnectionDepsForTest();
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

describe("useLiveBrowserConnectionTruth", () => {
  it("reads well-known connection metadata from the selected gomtm server url only", async () => {
    const payload = {
      version: 2,
      server: {
        public_url: "https://gomtm2.yuepa8.com",
      },
      p2p: {
        enabled: true,
        generation: "gen-1",
      },
      browser: {
        generation: "gen-1",
        primary_transport: "ws",
        candidates: [
          {
            transport: "ws",
            addr: "/dns4/gomtm2.yuepa8.com/tcp/443/ws/p2p/12D3KooWBootstrap",
            priority: 50,
          },
        ],
      },
    };
    const fetchMock = vi.fn(async () => payload);

    __setLiveConnectionDepsForTest({
      fetchJson: fetchMock,
    });

    render(
      <QueryClientProvider client={createTestQueryClient()}>
        <LiveConnectionProbe serverUrl="https://gomtm2.yuepa8.com" />
      </QueryClientProvider>,
    );

    await waitFor(() => {
      expect(screen.getByTestId("live-connection-state").textContent).toBe("success");
    });

    expect(fetchMock).toHaveBeenCalledWith("https://gomtm2.yuepa8.com/.well-known/gomtm-connection");
  });

  it("accepts the new direct browser connection truth contract", async () => {
    const payload = {
      version: 2,
      server: {
        public_url: "https://gomtm2.yuepa8.com",
      },
      p2p: {
        enabled: true,
        generation: "gen-2",
      },
      browser: {
        generation: "gen-2",
        primary_transport: "ws",
        candidates: [
          {
            transport: "ws",
            addr: "/dns4/gomtm2.yuepa8.com/tcp/443/ws/p2p/12D3KooWBootstrap",
            priority: 50,
          },
        ],
      },
    };
    const fetchMock = vi.fn(async () => payload);

    __setLiveConnectionDepsForTest({
      fetchJson: fetchMock,
    });

    render(
      <QueryClientProvider client={createTestQueryClient()}>
        <LiveConnectionProbe serverUrl="https://gomtm2.yuepa8.com" />
      </QueryClientProvider>,
    );

    await waitFor(() => {
      expect(screen.getByTestId("live-connection-state").textContent).toBe("success");
    });

    expect(fetchMock).toHaveBeenCalledWith("https://gomtm2.yuepa8.com/.well-known/gomtm-connection");
  });

  it("stays idle when server url is missing", async () => {
    const fetchMock = vi.fn();
    __setLiveConnectionDepsForTest({
      fetchJson: fetchMock,
    });

    render(
      <QueryClientProvider client={createTestQueryClient()}>
        <LiveConnectionProbe serverUrl={null} />
      </QueryClientProvider>,
    );

    await waitFor(() => {
      expect(screen.getByTestId("live-connection-state").textContent).toBe("pending");
    });

    expect(fetchMock).not.toHaveBeenCalled();
  });
});
