"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { PeerCandidate } from "@/lib/p2p/discovery-contracts";
import {
  type P2PRuntimeState,
  type P2PStatus,
  getRuntimeNodeSummary,
} from "./p2p-runtime-contract";
import { getGomtmHostBridge, type GomtmHostBridge } from "./select-p2p-runtime";

type AndroidHostBridgeMethod = (...args: string[]) => unknown;

const HOST_SNAPSHOT_REFRESH_INTERVAL_MS = 5_000;

function asRecord(value: unknown) {
  return value !== null && typeof value === "object" ? (value as Record<string, unknown>) : null;
}

function asString(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function getRuntimeIdentity(params: {
  activeConnectionAddr: string;
  currentNode: ReturnType<typeof getRuntimeNodeSummary>;
  serverUrl: string;
}) {
  return [params.serverUrl.trim(), params.activeConnectionAddr.trim(), params.currentNode?.peerId ?? ""].join("|");
}

async function resolveBridgeMethod(
  bridge: GomtmHostBridge | null,
  methodName: keyof GomtmHostBridge,
  ...args: string[]
) {
  const method = bridge?.[methodName] as AndroidHostBridgeMethod | undefined;
  if (typeof method !== "function") {
    return null;
  }

  return await resolveBridgeValue(method(...args));
}

function normalizeRuntimeStatus(value: unknown, serverUrl: string, peerCount: number): P2PStatus {
  const status = asString(value).toLowerCase();
  if (
    status === "loading" ||
    status === "needs-server-url" ||
    status === "fetching-connection-truth" ||
    status === "joining" ||
    status === "discovering" ||
    status === "peer_candidates_ready" ||
    status === "error"
  ) {
    return status;
  }

  if (serverUrl === "") {
    return "needs-server-url";
  }

  if (status === "error" || status === "degraded") {
    return "error";
  }

  return peerCount > 0 ? "peer_candidates_ready" : "discovering";
}

async function resolveBridgeValue(value: unknown) {
  const resolved = await Promise.resolve(value);
  if (typeof resolved !== "string") {
    return resolved;
  }

  const normalized = resolved.trim();
  if (normalized === "") {
    return null;
  }

  try {
    return JSON.parse(normalized) as unknown;
  } catch {
    return normalized;
  }
}

function normalizePeerCandidates(value: unknown): PeerCandidate[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((entry) => {
      const record = asRecord(entry);
      if (record == null) {
        return null;
      }

      const peerId = asString(record.peerId ?? record.peer_id ?? record.id);
      if (peerId === "") {
        return null;
      }

      const multiaddrs = Array.isArray(record.multiaddrs)
        ? record.multiaddrs.filter((candidate): candidate is string => typeof candidate === "string" && candidate.trim() !== "")
        : [];

      return {
        peerId,
        multiaddrs,
        lastDiscoveredAt: asString(
          record.lastDiscoveredAt ?? record.last_discovered_at ?? record.lastSeenAt ?? record.last_seen_at,
        ),
      } satisfies PeerCandidate;
    })
    .filter((candidate): candidate is PeerCandidate => candidate != null);
}

export function useAndroidHostRuntime(): P2PRuntimeState {
  const [serverUrl, setServerUrl] = useState("");
  const [serverUrlInput, setServerUrlInput] = useState("");
  const [status, setStatus] = useState<P2PStatus>("loading");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [activeConnectionAddr, setActiveConnectionAddr] = useState("");
  const [peerCandidates, setPeerCandidates] = useState<PeerCandidate[]>([]);
  const [currentNode, setCurrentNode] = useState<ReturnType<typeof getRuntimeNodeSummary>>(null);
  const [diagnostics, setDiagnostics] = useState<Record<string, unknown>>({});
  const runtimeIdentityRef = useRef<string | null>(null);
  const didHydrateServerUrlInputRef = useRef(false);
  const serverUrlInputRef = useRef("");

  const syncCanonicalServerUrl = useCallback(
    (nextServerUrl: string, options?: { forceInputSync?: boolean }) => {
      const previousCanonicalServerUrl = serverUrl;
      const inputIsDirty =
        didHydrateServerUrlInputRef.current && serverUrlInputRef.current.trim() !== previousCanonicalServerUrl.trim();

      setServerUrl(nextServerUrl);
      if (!didHydrateServerUrlInputRef.current || options?.forceInputSync === true || !inputIsDirty) {
        didHydrateServerUrlInputRef.current = true;
        serverUrlInputRef.current = nextServerUrl;
        setServerUrlInput(nextServerUrl);
      }
    },
    [serverUrl],
  );

  const setServerUrlInputValue = useCallback((value: string) => {
    didHydrateServerUrlInputRef.current = true;
    serverUrlInputRef.current = value;
    setServerUrlInput(value);
  }, []);

  const hydrateHostSnapshot = useCallback(async () => {
    if (typeof window === "undefined") {
      return;
    }

    const bridge = getGomtmHostBridge(window);
    if (bridge == null) {
      setStatus("error");
      setErrorMessage("Android host bridge is unavailable.");
      return;
    }

    try {
      const [hostInfo, connectionConfig, runtimeSnapshot, peerList] = await Promise.all([
        resolveBridgeMethod(bridge, "getHostInfo"),
        resolveBridgeMethod(bridge, "getConnectionConfig"),
        resolveBridgeMethod(bridge, "getRuntimeSnapshot"),
        resolveBridgeMethod(bridge, "listDiscoveredPeers"),
      ]);

      const connectionRecord = asRecord(connectionConfig);
      const runtimeRecord = asRecord(runtimeSnapshot);
      const hostRecord = asRecord(hostInfo);
      const nextServerUrl = asString(
        connectionRecord?.connectionAddress ??
          connectionRecord?.serverUrl ??
          connectionRecord?.server_url ??
          runtimeRecord?.serverUrl ??
          runtimeRecord?.server_url ??
          hostRecord?.serverUrl ??
          hostRecord?.server_url,
      );
      const nextConnectionAddr = asString(
        runtimeRecord?.activeConnectionAddr ??
          runtimeRecord?.active_connection_addr ??
          runtimeRecord?.connectionAddr ??
          runtimeRecord?.connectionAddress ??
          runtimeRecord?.connection_address,
      );
      const nextPeers = normalizePeerCandidates(
        peerList ?? runtimeRecord?.discoveredPeers ?? runtimeRecord?.peers ?? runtimeRecord?.peerCandidates ?? [],
      );
      const nextCurrentNode =
        getRuntimeNodeSummary(runtimeRecord?.currentNode) ??
        getRuntimeNodeSummary(runtimeRecord?.node) ??
        getRuntimeNodeSummary({ peerId: runtimeRecord?.peerId ?? runtimeRecord?.peer_id }) ??
        getRuntimeNodeSummary(hostRecord?.currentNode) ??
        getRuntimeNodeSummary(hostRecord);
      const nextRuntimeIdentity = getRuntimeIdentity({
        activeConnectionAddr: nextConnectionAddr,
        currentNode: nextCurrentNode,
        serverUrl: nextServerUrl,
      });

      runtimeIdentityRef.current = nextRuntimeIdentity;

      syncCanonicalServerUrl(nextServerUrl);
      setActiveConnectionAddr(nextConnectionAddr);
      setPeerCandidates(nextPeers);
      setCurrentNode(nextCurrentNode);
      setDiagnostics({
        connectionConfig,
        hostInfo,
        runtimeSnapshot,
      });
      setErrorMessage(null);
      setStatus(normalizeRuntimeStatus(runtimeRecord?.status, nextServerUrl, nextPeers.length));
    } catch (error) {
      setStatus("error");
      setErrorMessage(error instanceof Error ? error.message : String(error));
    }
  }, [syncCanonicalServerUrl]);

  useEffect(() => {
    let cancelled = false;

    void (async () => {
      await hydrateHostSnapshot();
      if (cancelled) {
        return;
      }
    })();

    const handleFocus = () => {
      if (cancelled) {
        return;
      }
      void hydrateHostSnapshot();
    };

    const handleVisibilityChange = () => {
      if (cancelled || document.visibilityState !== "visible") {
        return;
      }
      void hydrateHostSnapshot();
    };

    const refreshTimer = window.setInterval(() => {
      if (cancelled || document.visibilityState !== "visible") {
        return;
      }
      void hydrateHostSnapshot();
    }, HOST_SNAPSHOT_REFRESH_INTERVAL_MS);

    window.addEventListener("focus", handleFocus);
    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      cancelled = true;
      window.clearInterval(refreshTimer);
      window.removeEventListener("focus", handleFocus);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [hydrateHostSnapshot]);

  const saveConnection = useCallback(async (connection: string) => {
    const normalized = connection.trim();
    runtimeIdentityRef.current = null;
    syncCanonicalServerUrl(normalized, { forceInputSync: true });
    setStatus(normalized === "" ? "needs-server-url" : "discovering");

    if (typeof window === "undefined") {
      return;
    }

    const bridge = getGomtmHostBridge(window);
    if (bridge?.saveConnectionConfig != null) {
      await resolveBridgeMethod(
        bridge,
        "saveConnectionConfig",
        JSON.stringify({ connectionAddress: normalized }),
      );
    }
    await hydrateHostSnapshot();
  }, [hydrateHostSnapshot, syncCanonicalServerUrl]);

  const peers = useMemo(
    () => peerCandidates.map((peer) => getRuntimeNodeSummary(peer) ?? { peerId: peer.peerId, multiaddrs: peer.multiaddrs, discoveredAt: peer.lastDiscoveredAt }),
    [peerCandidates],
  );

  return {
    hostKind: "android-host",
    currentNode,
    peers,
    status,
    diagnostics,
    saveConnection,
    activeConnectionAddr,
    canConnect: serverUrl.trim() !== "" && status !== "loading" && status !== "joining" && status !== "discovering",
    connect: async () => serverUrl.trim() !== "",
    debugConnectPhase: "android-host",
    debugLastError: null,
    errorMessage,
    isConnected: status === "discovering" || status === "peer_candidates_ready",
    peerCandidates,
    saveServerUrl: async () => saveConnection(serverUrlInput),
    serverUrl,
    serverUrlInput,
    setServerUrlInput: setServerUrlInputValue,
  } satisfies P2PRuntimeState;
}
