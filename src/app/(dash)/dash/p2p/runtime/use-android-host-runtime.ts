"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { PeerCandidate } from "@/lib/p2p/discovery-contracts";
import {
  buildRuntimeCapabilitiesFromTruth,
  getPeerCapabilityTruthFromRuntimeCapabilities,
  normalizeRuntimeCapabilities,
  type ReadPeerCapabilitiesOptions,
  type RuntimeCapability,
  type P2PRuntimeState,
  type P2PStatus,
  getRuntimeNodeSummary,
  type ResolvedPeerTruthMap,
} from "./p2p-runtime-contract";
import { getGomtmHostBridge, type GomtmHostBridge } from "./select-p2p-runtime";

type ResolvedPeerCapabilitiesMap = Record<string, RuntimeCapability[]>;

type AndroidHostBridgeMethod = (...args: string[]) => unknown;

const HOST_SNAPSHOT_REFRESH_INTERVAL_MS = 5_000;

function asRecord(value: unknown) {
  return value !== null && typeof value === "object" ? (value as Record<string, unknown>) : null;
}

function asString(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function getResolvedPeerCapabilities(cache: ResolvedPeerCapabilitiesMap, peerId: string) {
  const normalizedPeerId = peerId.trim();
  if (normalizedPeerId === "") {
    return null;
  }
  return Object.hasOwn(cache, normalizedPeerId) ? (cache[normalizedPeerId] ?? []) : null;
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
  const resolvedPeerCapabilitiesRef = useRef<ResolvedPeerCapabilitiesMap>({});
  const resolvedPeerTruthRef = useRef<ResolvedPeerTruthMap>({});
  const runtimeIdentityRef = useRef<string | null>(null);
  const didHydrateServerUrlInputRef = useRef(false);
  const serverUrlInputRef = useRef("");

  const clearResolvedPeerState = useCallback(() => {
    resolvedPeerCapabilitiesRef.current = {};
    resolvedPeerTruthRef.current = {};
  }, []);

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

      if (runtimeIdentityRef.current != null && runtimeIdentityRef.current !== nextRuntimeIdentity) {
        clearResolvedPeerState();
      }
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
  }, [clearResolvedPeerState, syncCanonicalServerUrl]);

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

  const replaceResolvedPeerCapabilities = useCallback((peerId: string, capabilities: RuntimeCapability[]) => {
    const normalizedPeerId = peerId.trim();
    if (normalizedPeerId === "") {
      return null;
    }

    resolvedPeerCapabilitiesRef.current = {
      ...resolvedPeerCapabilitiesRef.current,
      [normalizedPeerId]: capabilities,
    };

    const truth = getPeerCapabilityTruthFromRuntimeCapabilities(capabilities);
    if (truth == null) {
      if (Object.hasOwn(resolvedPeerTruthRef.current, normalizedPeerId)) {
        const nextTruth = { ...resolvedPeerTruthRef.current };
        delete nextTruth[normalizedPeerId];
        resolvedPeerTruthRef.current = nextTruth;
      }
      return null;
    }

    resolvedPeerTruthRef.current = {
      ...resolvedPeerTruthRef.current,
      [normalizedPeerId]: truth,
    };
    return truth;
  }, []);

  const saveConnection = useCallback(async (connection: string) => {
    const normalized = connection.trim();
    clearResolvedPeerState();
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
  }, [clearResolvedPeerState, hydrateHostSnapshot, syncCanonicalServerUrl]);

  const readPeerCapabilities = useCallback(
    async (peerId: string, options?: ReadPeerCapabilitiesOptions) => {
      const shouldForceRefresh = options?.forceRefresh === true;
      if (!shouldForceRefresh) {
        const cachedCapabilities = getResolvedPeerCapabilities(resolvedPeerCapabilitiesRef.current, peerId);
        if (cachedCapabilities != null) {
          return cachedCapabilities;
        }
      }

      let capabilities = [] as ReturnType<typeof normalizeRuntimeCapabilities>;

      if (typeof window !== "undefined") {
        const bridge = getGomtmHostBridge(window);
        if (bridge?.getPeerCapabilities != null) {
          capabilities = normalizeRuntimeCapabilities(await resolveBridgeMethod(bridge, "getPeerCapabilities", peerId));
        }
      }

      if (capabilities.length > 0 || shouldForceRefresh) {
        replaceResolvedPeerCapabilities(peerId, capabilities);
        return capabilities;
      }

      const truth = resolvedPeerTruthRef.current[peerId.trim()];
      if (truth == null) {
        return capabilities;
      }

      return buildRuntimeCapabilitiesFromTruth(truth);
    },
    [replaceResolvedPeerCapabilities],
  );

  const resolvePeerCapabilityReadAddress = useCallback(
    async (peerId: string) => {
      const targetPeer = peerCandidates.find((candidate) => candidate.peerId === peerId) ?? null;
      const targetAddress = targetPeer?.multiaddrs.find((value) => value.trim() !== "") ?? peerId.trim();
      return targetAddress === "" ? null : targetAddress;
    },
    [peerCandidates],
  );

  const getResolvedPeerTruthForRuntime = useCallback(
    (peerId: string) => resolvedPeerTruthRef.current[peerId.trim()] ?? null,
    [],
  );

  const getResolvedPeerCapabilitiesForRuntime = useCallback(
    (peerId: string) => getResolvedPeerCapabilities(resolvedPeerCapabilitiesRef.current, peerId),
    [],
  );

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
    getResolvedPeerCapabilities: getResolvedPeerCapabilitiesForRuntime,
    readPeerCapabilities,
    resolvePeerCapabilityReadAddress,
    saveConnection,
    activeConnectionAddr,
    canConnect: serverUrl.trim() !== "" && status !== "loading" && status !== "joining" && status !== "discovering",
    connect: async () => serverUrl.trim() !== "",
    debugConnectPhase: "android-host",
    debugLastError: null,
    errorMessage,
    getResolvedPeerTruth: getResolvedPeerTruthForRuntime,
    isConnected: status === "discovering" || status === "peer_candidates_ready",
    peerCandidates,
    saveServerUrl: async () => saveConnection(serverUrlInput),
    serverUrl,
    serverUrlInput,
    setServerUrlInput: setServerUrlInputValue,
  };
}
