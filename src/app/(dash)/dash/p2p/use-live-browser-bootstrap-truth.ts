import { createElement } from "react";
import { useQuery } from "@tanstack/react-query";
import { parsePublicBootstrapMetadata } from "@/lib/p2p/bootstrap-truth";

type LiveBootstrapDeps = {
  fetchJson: (url: string) => Promise<unknown>;
};

function normalizeServerUrl(value: string | null | undefined) {
  const trimmed = value?.trim();
  if (!trimmed) {
    return null;
  }
  return trimmed.replace(/\/$/, "");
}

const defaultLiveBootstrapDeps: LiveBootstrapDeps = {
  fetchJson: async (url) => {
    const response = await fetch(url, { credentials: "omit" });
    if (!response.ok) {
      throw new Error(`public bootstrap metadata request failed: ${response.status}`);
    }

    return response.json();
  },
};

let liveBootstrapDeps = defaultLiveBootstrapDeps;

export function __setLiveBootstrapDepsForTest(overrides: Partial<LiveBootstrapDeps>) {
  liveBootstrapDeps = {
    ...defaultLiveBootstrapDeps,
    ...overrides,
  };
}

export function __resetLiveBootstrapDepsForTest() {
  liveBootstrapDeps = defaultLiveBootstrapDeps;
}

export function useLiveBrowserBootstrapTruth(serverUrl: string | null | undefined) {
  const normalizedServerUrl = normalizeServerUrl(serverUrl);
  const truthQuery = useQuery({
    queryKey: ["live-browser-bootstrap-truth", normalizedServerUrl],
    enabled: normalizedServerUrl != null,
    queryFn: async () => {
      const payload = await liveBootstrapDeps.fetchJson(`${normalizedServerUrl}/.well-known/gomtm-bootstrap`);
      const metadata = parsePublicBootstrapMetadata(payload);
      if (metadata.p2p.browser == null) {
        throw new Error(`gomtm server ${normalizedServerUrl} 未返回浏览器 bootstrap truth`);
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

export function LiveBootstrapProbe(props: { serverUrl?: string | null }) {
  const { truthQuery } = useLiveBrowserBootstrapTruth(props.serverUrl ?? null);

  return createElement("div", { "data-testid": "live-bootstrap-state" }, truthQuery.status);
}
