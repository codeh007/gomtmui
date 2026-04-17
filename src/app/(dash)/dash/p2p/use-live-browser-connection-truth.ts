import { createElement } from "react";
import { useQuery } from "@tanstack/react-query";
import { parsePublicConnectionMetadata } from "@/lib/p2p/connection-truth";

type LiveConnectionDeps = {
  fetchJson: (url: string) => Promise<unknown>;
};

function normalizeServerUrl(value: string | null | undefined) {
  const trimmed = value?.trim();
  if (!trimmed) {
    return null;
  }
  return trimmed.replace(/\/$/, "");
}

const defaultLiveConnectionDeps: LiveConnectionDeps = {
  fetchJson: async (url) => {
    const response = await fetch(url, { credentials: "omit" });
    if (!response.ok) {
      throw new Error(`public connection metadata request failed: ${response.status}`);
    }

    return response.json();
  },
};

let liveConnectionDeps = defaultLiveConnectionDeps;

export function __setLiveConnectionDepsForTest(overrides: Partial<LiveConnectionDeps>) {
  liveConnectionDeps = {
    ...defaultLiveConnectionDeps,
    ...overrides,
  };
}

export function __resetLiveConnectionDepsForTest() {
  liveConnectionDeps = defaultLiveConnectionDeps;
}

export function useLiveBrowserConnectionTruth(serverUrl: string | null | undefined) {
  const normalizedServerUrl = normalizeServerUrl(serverUrl);
  const truthQuery = useQuery({
    queryKey: ["live-browser-connection-truth", normalizedServerUrl],
    enabled: normalizedServerUrl != null,
    queryFn: async () => {
      const payload = await liveConnectionDeps.fetchJson(`${normalizedServerUrl}/.well-known/gomtm-connection`);
      const metadata = parsePublicConnectionMetadata(payload);
      if (metadata.p2p.browser == null) {
        throw new Error(`gomtm server ${normalizedServerUrl} 未返回浏览器连接 truth`);
      }
      return metadata.p2p.browser;
    },
  });

  return {
    accessUrl: normalizedServerUrl,
    readyServers: normalizedServerUrl == null ? [] : [{ id: "selected-server", accessUrl: normalizedServerUrl }],
    truthQuery,
  };
}

export function LiveConnectionProbe(props: { serverUrl?: string | null }) {
  const { truthQuery } = useLiveBrowserConnectionTruth(props.serverUrl ?? null);

  return createElement(
    "div",
    {
      "data-testid": "live-connection-state",
      "data-error-message": truthQuery.error instanceof Error ? truthQuery.error.message : "",
    },
    truthQuery.status,
  );
}
