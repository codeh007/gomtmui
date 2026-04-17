"use client";

import { createElement, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { parsePublicBootstrapMetadata } from "@/lib/p2p/bootstrap-truth";

type LiveBootstrapDeps = {
  getCandidateOrigins: () => string[];
  fetchJson: (url: string) => Promise<unknown>;
};

function normalizeOrigin(value: string | null | undefined) {
  const trimmed = value?.trim();
  if (!trimmed) {
    return null;
  }
  return trimmed.replace(/\/$/, "");
}

function listCandidateOrigins() {
  const seen = new Set<string>();
  const results: string[] = [];

  const add = (value: string | null | undefined) => {
    const normalized = normalizeOrigin(value);
    if (normalized == null || seen.has(normalized)) {
      return;
    }
    seen.add(normalized);
    results.push(normalized);
  };

  if (typeof window !== "undefined") {
    add(window.location.origin);
  }

  add(process.env.NEXT_PUBLIC_GOMTM_PUBLIC_URL);
  add("https://gomtm2.yuepa8.com");

  return results;
}

const defaultLiveBootstrapDeps: LiveBootstrapDeps = {
  getCandidateOrigins: listCandidateOrigins,
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

function useCandidateOrigins() {
  return useMemo(() => liveBootstrapDeps.getCandidateOrigins(), []);
}

export function useLiveBrowserBootstrapTruth() {
  const candidateOrigins = useCandidateOrigins();
  const truthQuery = useQuery({
    queryKey: ["live-browser-bootstrap-truth", candidateOrigins],
    enabled: candidateOrigins.length > 0,
    queryFn: async () => {
      let lastError: unknown = null;

      for (const origin of candidateOrigins) {
        try {
          const payload = await liveBootstrapDeps.fetchJson(`${origin}/.well-known/gomtm-bootstrap`);
          const metadata = parsePublicBootstrapMetadata(payload);
          if (metadata.p2p.browser != null) {
            return {
              accessUrl: origin,
              truth: metadata.p2p.browser,
            };
          }
        } catch (error) {
          lastError = error;
        }
      }

      throw lastError ?? new Error("missing live gomtm bootstrap metadata origin");
    },
  });

  const selectedOrigin = truthQuery.data?.accessUrl ?? candidateOrigins[0] ?? null;

  return {
    accessUrl: selectedOrigin,
    readyServers: selectedOrigin == null ? [] : [{ id: "origin-1", accessUrl: selectedOrigin }],
    truthQuery: {
      ...truthQuery,
      data: truthQuery.data?.truth ?? null,
    },
  };
}

export function LiveBootstrapProbe() {
  const { truthQuery } = useLiveBrowserBootstrapTruth();

  return createElement("div", { "data-testid": "live-bootstrap-state" }, truthQuery.status);
}
