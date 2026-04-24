"use client";

import { useCallback, useEffect, useState } from "react";
import { fetchServerPeerDirectory } from "@/lib/p2p/server-peer-directory-api";
import { fetchServerSelfNode } from "@/lib/p2p/server-self-node-api";
import type { P2PShellState } from "./p2p-runtime-contract";

const STORAGE_KEY = "gomtm:p2p:server-url";

type ServerShellNodeSummary = {
  peerId: string;
  multiaddrs?: string[];
  discoveredAt?: string;
};

export type P2PServerShellState = {
  shellKind: "server-shell";
  currentNode: ServerShellNodeSummary | null;
  peers: ServerShellNodeSummary[];
  status: "loading" | "needs-server-url" | "discovering" | "peer_candidates_ready" | "error";
  diagnostics: Record<string, unknown>;
  errorMessage: string | null;
  isConnected: boolean;
  serverUrl: string;
  serverUrlInput: string;
  setServerUrlInput: (value: string) => void;
  saveServerUrl: () => Promise<void>;
};

function readStoredServerUrl() {
  return typeof window === "undefined" ? "" : window.localStorage.getItem(STORAGE_KEY)?.trim() ?? "";
}

function persistStoredServerUrl(value: string) {
  if (typeof window === "undefined") {
    return;
  }
  window.localStorage.setItem(STORAGE_KEY, value);
}

function getRuntimeNodeSummary(input: { lastDiscoveredAt?: string; multiaddrs?: string[]; peerId?: string }): ServerShellNodeSummary | null {
  const peerId = input.peerId?.trim() ?? "";
  if (peerId === "") {
    return null;
  }

  const multiaddrs = (input.multiaddrs ?? []).filter((value) => value.trim() !== "");
  return {
    peerId,
    multiaddrs: multiaddrs.length === 0 ? undefined : multiaddrs,
    discoveredAt: input.lastDiscoveredAt?.trim() || undefined,
  };
}

export function useServerShellRuntime(): P2PShellState {
  const [serverUrl, setServerUrl] = useState("");
  const [serverUrlInput, setServerUrlInput] = useState("");
  const [status, setStatus] = useState<P2PServerShellState["status"]>("loading");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [currentNode, setCurrentNode] = useState<ServerShellNodeSummary | null>(null);
  const [peers, setPeers] = useState<ServerShellNodeSummary[]>([]);

  const reload = useCallback(async (nextServerUrl: string) => {
    const normalized = nextServerUrl.trim();
    setServerUrl(normalized);
    setServerUrlInput(normalized);

    if (normalized === "") {
      setStatus("needs-server-url");
      setCurrentNode(null);
      setPeers([]);
      setErrorMessage(null);
      return;
    }

    setStatus("discovering");
    setErrorMessage(null);

    try {
      const [selfNode, directory] = await Promise.all([fetchServerSelfNode(normalized), fetchServerPeerDirectory(normalized)]);

      const nextCurrentNode = getRuntimeNodeSummary({
        peerId: selfNode.peerId,
        multiaddrs: selfNode.connectionAddr === "" ? [] : [selfNode.connectionAddr],
      });
      if (nextCurrentNode == null) {
        throw new Error("gomtm server self node truth 缺少有效 peer_id。");
      }

      const nextPeers = directory
        .filter((record) => record.peerId !== selfNode.peerId)
        .map((record) =>
          getRuntimeNodeSummary({
            peerId: record.peerId,
            multiaddrs: record.multiaddrs,
            lastDiscoveredAt: record.lastSeenAt,
          }),
        )
        .filter((record): record is ServerShellNodeSummary => record != null);

      setCurrentNode(nextCurrentNode);
      setPeers(nextPeers);
      setStatus("peer_candidates_ready");
    } catch (error) {
      setCurrentNode(null);
      setPeers([]);
      setStatus("error");
      setErrorMessage(error instanceof Error ? error.message : String(error));
    }
  }, []);

  useEffect(() => {
    void reload(readStoredServerUrl());
  }, [reload]);

  const saveServerUrl = useCallback(async () => {
    const normalized = serverUrlInput.trim();
    persistStoredServerUrl(normalized);
    await reload(normalized);
  }, [reload, serverUrlInput]);

  return {
    shellKind: "server-shell",
    currentNode,
    peers,
    status,
    diagnostics: {},
    errorMessage,
    isConnected: status === "discovering" || status === "peer_candidates_ready",
    serverUrl,
    serverUrlInput,
    setServerUrlInput,
    saveServerUrl,
  };
}
