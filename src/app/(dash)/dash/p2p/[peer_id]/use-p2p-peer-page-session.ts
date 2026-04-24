"use client";

import { useEffect, useState } from "react";
import { canOpenAndroidView, type PeerCapabilityTruth } from "@/lib/p2p/discovery-contracts";
import { fetchServerPeerCapabilities } from "@/lib/p2p/server-peer-operator-api";
import {
  getPeerCapabilityTruthFromRuntimeCapabilities,
  type RuntimeCapability,
} from "../runtime/p2p-runtime-contract";
import { useP2PShellState } from "../runtime/p2p-runtime-provider";

export type PeerTruthStatus = "idle" | "loading" | "ready" | "error";

export function useP2PPeerPageSession(peerId: string) {
  const p2pSession = useP2PShellState();
  const isConnected = p2pSession.isConnected;
  const [peerTruthStatus, setPeerTruthStatus] = useState<PeerTruthStatus>("idle");
  const [peerTruthErrorMessage, setPeerTruthErrorMessage] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);
  const [stableTargetPeer, setStableTargetPeer] = useState<ReturnType<typeof useMemoTargetPeer> | null>(null);
  const [capabilities, setCapabilities] = useState<RuntimeCapability[]>([]);
  const [capabilityTruth, setCapabilityTruth] = useState<PeerCapabilityTruth | null>(null);
  const runtimeSessionIdentity = [
    p2pSession.shellKind,
    p2pSession.serverUrl.trim(),
    p2pSession.currentNode?.peerId ?? "",
  ].join("|");

  const liveTargetPeer = useMemoTargetPeer(p2pSession.peers, peerId);
  const targetPeer = liveTargetPeer ?? stableTargetPeer;

  useEffect(() => {
    setStableTargetPeer(null);
    setCapabilities([]);
    setCapabilityTruth(null);
    setPeerTruthStatus("idle");
    setPeerTruthErrorMessage(null);
    setRefreshKey(0);
  }, [peerId, runtimeSessionIdentity]);

  useEffect(() => {
    if (!isConnected) {
      setStableTargetPeer(null);
      setCapabilities([]);
      setCapabilityTruth(null);
      return;
    }
    if (liveTargetPeer != null) {
      setStableTargetPeer(liveTargetPeer);
    }
  }, [isConnected, liveTargetPeer]);

  const hasPeerTruthError = peerTruthStatus === "error";

  useEffect(() => {
    if (!isConnected) {
      setCapabilities([]);
      setCapabilityTruth(null);
      setPeerTruthStatus("idle");
      setPeerTruthErrorMessage(null);
      return;
    }

    let cancelled = false;

    async function loadPeerTruth() {
      setPeerTruthStatus("loading");
      setPeerTruthErrorMessage(null);

      try {
        const nextCapabilities = await fetchServerPeerCapabilities({
          peerId,
          serverUrl: p2pSession.serverUrl,
        });
        if (cancelled) {
          return;
        }

        setCapabilities(nextCapabilities);
        setCapabilityTruth(getPeerCapabilityTruthFromRuntimeCapabilities(nextCapabilities));
        setPeerTruthStatus("ready");
        setPeerTruthErrorMessage(null);
        if (refreshKey !== 0) {
          setRefreshKey(0);
        }
      } catch (error) {
        if (cancelled) {
          return;
        }
        setCapabilities([]);
        setCapabilityTruth(null);
        setPeerTruthStatus("error");
        setPeerTruthErrorMessage(error instanceof Error ? error.message : String(error));
      }
    }

    void loadPeerTruth();

    return () => {
      cancelled = true;
    };
  }, [isConnected, p2pSession.serverUrl, peerId, refreshKey]);

  const canOpenAndroid = canOpenAndroidView(capabilityTruth?.remoteControl);
  const peer = targetPeer;
  const hasCapabilityPayload = capabilityTruth != null || capabilities.length > 0;
  const diagnostics = {
    ...p2pSession.diagnostics,
    errorMessage: p2pSession.errorMessage || undefined,
    shellKind: p2pSession.shellKind,
    peerTruthErrorMessage: peerTruthErrorMessage || undefined,
    peerTruthStatus,
    serverUrl: p2pSession.serverUrl || undefined,
    status: p2pSession.status,
  } satisfies Record<string, unknown>;
  const isPeerTruthLoading = ["idle", "loading"].includes(peerTruthStatus) && !hasCapabilityPayload;

  return {
    ...p2pSession,
    capabilityTruth,
    canOpenAndroid,
    capabilities,
    diagnostics,
    hasPeerTruthError,
    isPeerTruthLoading,
    peer,
    peerId,
    peerTruthErrorMessage,
    peerTruthStatus,
    refreshPeerTruth: () => setRefreshKey((current) => current + 1),
    targetPeer,
  };
}

function useMemoTargetPeer(peers: ReturnType<typeof useP2PShellState>["peers"], peerId: string) {
  return peers.find((candidate) => candidate.peerId === peerId) ?? null;
}
