"use client";

import { createElement, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerInstanceListInfinite } from "@/components/server-instance/hooks";
import { getServerAccessUrl, type ServerInstanceStatusDto } from "@/components/server-instance/status-contract";
import { parseMaybeBrowserBootstrapTruth } from "@/lib/p2p/bootstrap-truth";

export type ReadyServerBootstrapTarget = {
  id: string;
  accessUrl: string;
};

type LiveBootstrapDeps = {
  useReadyServers: () => ReadyServerBootstrapTarget[];
  fetchJson: (url: string) => Promise<unknown>;
};

function listReadyServers(rows: ServerInstanceStatusDto[]) {
  return rows.flatMap((row) => {
    const accessUrl = getServerAccessUrl(row.status, row.hostname);
    if (accessUrl == null) {
      return [];
    }

    return [
      {
        id: row.id,
        accessUrl,
      },
    ];
  });
}

function useReadyServersFromServerList() {
  const listQuery = useServerInstanceListInfinite({ pageSize: 20, poll: true });

  return useMemo(() => listReadyServers(listQuery.data?.pages.flat() ?? []), [listQuery.data]);
}

const defaultLiveBootstrapDeps: LiveBootstrapDeps = {
  useReadyServers: useReadyServersFromServerList,
  fetchJson: async (url) => {
    const response = await fetch(url, { credentials: "omit" });
    if (!response.ok) {
      throw new Error(`live bootstrap truth request failed: ${response.status}`);
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

function useConfiguredReadyServers() {
  return liveBootstrapDeps.useReadyServers();
}

function readBrowserBootstrapTruthFromStatusPayload(payload: unknown) {
  if (payload == null || typeof payload !== "object" || Array.isArray(payload)) {
    return null;
  }

  return parseMaybeBrowserBootstrapTruth((payload as { browser_bootstrap_truth?: unknown }).browser_bootstrap_truth);
}

export function useLiveBrowserBootstrapTruth() {
  const readyServers = useConfiguredReadyServers();
  const accessUrl = readyServers[0]?.accessUrl ?? null;

  const truthQuery = useQuery({
    queryKey: ["live-browser-bootstrap-truth", accessUrl],
    enabled: accessUrl != null,
    queryFn: async () => {
      if (accessUrl == null) {
        throw new Error("missing ready gomtm server access url");
      }

      const payload = await liveBootstrapDeps.fetchJson(`${accessUrl}/api/system/status`);
      return readBrowserBootstrapTruthFromStatusPayload(payload);
    },
  });

  return {
    accessUrl,
    readyServers,
    truthQuery,
  };
}

export function LiveBootstrapProbe() {
  const { truthQuery } = useLiveBrowserBootstrapTruth();

  return createElement("div", { "data-testid": "live-bootstrap-state" }, truthQuery.status);
}
