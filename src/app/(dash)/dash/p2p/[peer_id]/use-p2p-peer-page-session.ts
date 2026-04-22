"use client";

import { useEffect, useRef, useState } from "react";
import { canOpenAndroidView, type PeerCapabilityTruth } from "@/lib/p2p/discovery-contracts";
import { logP2PConsole } from "@/lib/p2p/p2p-console";
import {
  buildRuntimeCapabilitiesFromTruth,
  getPeerCapabilityTruthFromRuntimeCapabilities,
  type RuntimeCapability,
} from "../runtime/p2p-runtime-contract";
import { useP2PRuntime } from "../runtime/p2p-runtime-provider";

export type PeerTruthStatus = "idle" | "loading" | "ready" | "error";

export function useP2PPeerPageSession(peerId: string) {
  const p2pSession = useP2PRuntime();
  const hostKind = p2pSession.hostKind;
  const getResolvedPeerCapabilities = p2pSession.getResolvedPeerCapabilities;
  const isConnected = p2pSession.isConnected;
  const getResolvedPeerTruth = p2pSession.getResolvedPeerTruth;
  const readPeerCapabilities = p2pSession.readPeerCapabilities;
  const resolvePeerCapabilityReadAddress = p2pSession.resolvePeerCapabilityReadAddress;
  const [peerTruthStatus, setPeerTruthStatus] = useState<PeerTruthStatus>("idle");
  const [peerTruthErrorMessage, setPeerTruthErrorMessage] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);
  const [targetAddress, setTargetAddress] = useState<string | null>(null);
  const [stableTargetPeer, setStableTargetPeer] = useState<ReturnType<typeof useMemoTargetPeer> | null>(null);
  const [capabilityDescriptorsOverride, setCapabilityDescriptorsOverride] = useState<RuntimeCapability[] | null>(null);
  const [capabilityTruthOverride, setCapabilityTruthOverride] = useState<PeerCapabilityTruth | null>(null);
  const targetAddressResolveSeqRef = useRef(0);
  const runtimeSessionIdentity = [
    hostKind,
    p2pSession.serverUrl.trim(),
    p2pSession.activeConnectionAddr.trim(),
    p2pSession.currentNode?.peerId ?? "",
  ].join("|");

  const liveTargetPeer = useMemoTargetPeer(p2pSession.peerCandidates, peerId);
  const targetPeer = liveTargetPeer ?? stableTargetPeer;

  useEffect(() => {
    targetAddressResolveSeqRef.current += 1;
    setStableTargetPeer(null);
    setTargetAddress(null);
    setCapabilityDescriptorsOverride(null);
    setCapabilityTruthOverride(null);
    setPeerTruthStatus("idle");
    setPeerTruthErrorMessage(null);
    setRefreshKey(0);
  }, [peerId, runtimeSessionIdentity]);

  useEffect(() => {
    if (!isConnected) {
      setCapabilityDescriptorsOverride(null);
      setStableTargetPeer(null);
      return;
    }
    if (liveTargetPeer != null) {
      setStableTargetPeer(liveTargetPeer);
    }
  }, [isConnected, liveTargetPeer]);

  const capabilityTruth = capabilityTruthOverride ?? getResolvedPeerTruth(peerId);
  const cachedCapabilities = getResolvedPeerCapabilities?.(peerId) ?? null;
  const hasPeerTruthError = peerTruthStatus === "error";

  useEffect(() => {
    const requestSeq = targetAddressResolveSeqRef.current + 1;
    targetAddressResolveSeqRef.current = requestSeq;

    async function resolveTargetAddress() {
      if (!isConnected || targetPeer == null) {
        setTargetAddress(null);
        return;
      }

      const fallbackTargetAddress = targetPeer.multiaddrs.find((value) => value.trim() !== "") ?? peerId;

      if (resolvePeerCapabilityReadAddress != null) {
        const resolvedAddress = await resolvePeerCapabilityReadAddress(peerId);
        if (requestSeq === targetAddressResolveSeqRef.current) {
          const normalizedResolvedAddress = resolvedAddress?.trim() ?? "";
          setTargetAddress(
            normalizedResolvedAddress === ""
              ? hostKind === "android-host"
                ? fallbackTargetAddress
                : null
              : resolvedAddress,
          );
        }
        return;
      }

      if (hostKind === "browser") {
        if (requestSeq === targetAddressResolveSeqRef.current) {
          setTargetAddress(null);
        }
        return;
      }

      logP2PConsole(
        "debug",
        "[peer-page] resolveTargetAddress",
        {
          activeConnectionAddr: p2pSession.activeConnectionAddr,
          hostKind,
          multiaddrs: targetPeer.multiaddrs,
          peerId,
          resolvedAddress: fallbackTargetAddress,
        },
        { verboseOnly: true },
      );

      if (requestSeq === targetAddressResolveSeqRef.current) {
        setTargetAddress(fallbackTargetAddress);
      }
    }

    void resolveTargetAddress();

    return () => {
      if (targetAddressResolveSeqRef.current === requestSeq) {
        targetAddressResolveSeqRef.current += 1;
      }
    };
  }, [hostKind, isConnected, p2pSession.activeConnectionAddr, peerId, resolvePeerCapabilityReadAddress, targetPeer]);

  useEffect(() => {
    if (!isConnected || targetPeer == null) {
      setCapabilityDescriptorsOverride(null);
      setCapabilityTruthOverride(null);
      setPeerTruthStatus("idle");
      setPeerTruthErrorMessage(null);
      return;
    }

    if (hostKind === "browser" && targetAddress == null) {
      setPeerTruthStatus("error");
      setPeerTruthErrorMessage("目标节点当前没有 browser-dialable multiaddr，无法读取节点能力。");
      return;
    }

    let cancelled = false;

    async function loadPeerTruth() {
      if (refreshKey === 0 && (capabilityDescriptorsOverride != null || cachedCapabilities != null)) {
        setPeerTruthStatus("ready");
        setPeerTruthErrorMessage(null);
        return;
      }

      setPeerTruthStatus("loading");
      setPeerTruthErrorMessage(null);

      try {
        const capabilities = await readPeerCapabilities(peerId, refreshKey === 0 ? undefined : { forceRefresh: true });
        if (cancelled) {
          return;
        }

        setCapabilityDescriptorsOverride(capabilities);
        const nextTruth = getPeerCapabilityTruthFromRuntimeCapabilities(capabilities) ?? getResolvedPeerTruth(peerId);

        setCapabilityTruthOverride(nextTruth ?? null);
        setPeerTruthStatus("ready");
        setPeerTruthErrorMessage(null);
        if (refreshKey !== 0) {
          setRefreshKey(0);
        }
      } catch (error) {
        if (cancelled) {
          return;
        }
        setCapabilityDescriptorsOverride(null);
        setPeerTruthStatus("error");
        setPeerTruthErrorMessage(error instanceof Error ? error.message : String(error));
      }
    }

    void loadPeerTruth();

    return () => {
      cancelled = true;
    };
  }, [
    cachedCapabilities,
    capabilityDescriptorsOverride,
    capabilityTruth,
    hostKind,
    isConnected,
    peerId,
    readPeerCapabilities,
    refreshKey,
    targetAddress,
    targetPeer?.peerId,
  ]);

  const capabilities = cachedCapabilities ?? capabilityDescriptorsOverride ?? buildRuntimeCapabilitiesFromTruth(capabilityTruth);
  const canOpenAndroid = canOpenAndroidView(capabilityTruth?.remoteControl);
  const peer = targetPeer;
  const hasCapabilityPayload = capabilityTruth != null || capabilities.length > 0;
  const diagnostics = {
    ...p2pSession.diagnostics,
    activeConnectionAddr: p2pSession.activeConnectionAddr || undefined,
    errorMessage: p2pSession.errorMessage || undefined,
    hostKind,
    peerTruthErrorMessage: peerTruthErrorMessage || undefined,
    peerTruthStatus,
    status: p2pSession.status,
    targetAddress: targetAddress || undefined,
  } satisfies Record<string, unknown>;
  const isPeerTruthLoading = targetPeer != null && ["idle", "loading"].includes(peerTruthStatus) && !hasCapabilityPayload;

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
    targetAddress,
    targetPeer,
  };
}

function useMemoTargetPeer(peerCandidates: ReturnType<typeof useP2PRuntime>["peerCandidates"], peerId: string) {
  return peerCandidates.find((candidate) => candidate.peerId === peerId) ?? null;
}
