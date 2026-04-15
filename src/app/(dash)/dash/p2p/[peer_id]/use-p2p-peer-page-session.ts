"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { canOpenAndroidView, listPeerFeatureLabels, supportsVncView } from "@/lib/p2p/discovery-contracts";
import { deriveBrowserRelayAddressFromBootstrap } from "@/lib/p2p/libp2p-stream";
import { logP2PConsole } from "@/lib/p2p/p2p-console";
import { requestPeerCapabilityTruth } from "@/lib/p2p/worker-control";
import { normalizeBrowserBootstrapAddr } from "../p2p-bootstrap-storage";
import { useP2PSession } from "../use-p2p-session";

export type PeerTruthStatus = "idle" | "loading" | "ready" | "error";

function resolveCurrentNodePeerId(node: unknown) {
  if (node == null || typeof node !== "object") {
    return "";
  }

  const peerIdCandidate = (node as { id?: unknown; peerId?: unknown }).peerId ?? (node as { id?: unknown }).id;
  if (typeof peerIdCandidate === "string") {
    return peerIdCandidate.trim();
  }
  if (peerIdCandidate != null && typeof (peerIdCandidate as { toString: () => string }).toString === "function") {
    return (peerIdCandidate as { toString: () => string }).toString().trim();
  }

  return "";
}

function pickObservedRelayBrowserAddress(multiaddrs: string[]) {
  const normalized = multiaddrs
    .map((value) => normalizeBrowserBootstrapAddr(value.trim()))
    .filter((value) => value.startsWith("/"));
  return (
    normalized.find((value) => value.includes("/p2p-circuit/") && value.includes("/webtransport/")) ??
    normalized.find((value) => value.includes("/p2p-circuit/")) ??
    null
  );
}

export function useP2PPeerPageSession(peerId: string) {
  const p2pSession = useP2PSession();
  const isConnected = p2pSession.isConnected;
  const getResolvedPeerTruth = p2pSession.getResolvedPeerTruth;
  const rememberPeerTruth = p2pSession.rememberPeerTruth;
  const resolveDialableAddress = p2pSession.resolveDialableAddress;
  const currentNode = p2pSession.getCurrentNode();
  const currentNodePeerId = resolveCurrentNodePeerId(currentNode);
  const [peerTruthStatus, setPeerTruthStatus] = useState<PeerTruthStatus>("idle");
  const [peerTruthErrorMessage, setPeerTruthErrorMessage] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);
  const [targetAddress, setTargetAddress] = useState<string | null>(null);
  const [stableTargetPeer, setStableTargetPeer] = useState<ReturnType<typeof useMemoTargetPeer> | null>(null);
  const lastResolvedTruthContextRef = useRef<{ controllerPeerId: string; targetAddress: string } | null>(null);
  const targetAddressResolveSeqRef = useRef(0);

  const liveTargetPeer = useMemoTargetPeer(p2pSession.peerCandidates, peerId);
  const targetPeer = liveTargetPeer ?? stableTargetPeer;

  useEffect(() => {
    if (!isConnected || currentNode == null) {
      setStableTargetPeer(null);
      return;
    }
    if (liveTargetPeer != null) {
      setStableTargetPeer(liveTargetPeer);
    }
  }, [currentNode, isConnected, liveTargetPeer]);

  const capabilityTruth = getResolvedPeerTruth(peerId);
  const isPeerTruthLoading =
    targetPeer != null && ["idle", "loading"].includes(peerTruthStatus) && capabilityTruth == null;
  const hasPeerTruthError = peerTruthStatus === "error";

  useEffect(() => {
    const requestSeq = targetAddressResolveSeqRef.current + 1;
    targetAddressResolveSeqRef.current = requestSeq;

    async function resolveTargetAddress() {
      if (!isConnected || currentNode == null) {
        setTargetAddress(null);
        return;
      }
      if (targetPeer == null) {
        setTargetAddress(null);
        return;
      }
      const dialableAddress = normalizeBrowserBootstrapAddr((await resolveDialableAddress(targetPeer.multiaddrs)) ?? "");
      const observedRelayAddress = pickObservedRelayBrowserAddress(targetPeer.multiaddrs);
      const address =
        dialableAddress !== ""
          ? dialableAddress
          : (observedRelayAddress ??
            deriveBrowserRelayAddressFromBootstrap({
              activeBootstrapAddr: p2pSession.activeBootstrapAddr,
              multiaddrs: targetPeer.multiaddrs,
              peerId,
            }));
      logP2PConsole(
        "debug",
        "[peer-page] resolveTargetAddress",
        {
          activeBootstrapAddr: p2pSession.activeBootstrapAddr,
          multiaddrs: targetPeer.multiaddrs,
          peerId,
          resolvedAddress: address,
        },
        { verboseOnly: true },
      );
      if (requestSeq === targetAddressResolveSeqRef.current) {
        setTargetAddress((current) => address ?? current);
      }
    }

    void resolveTargetAddress();

    return () => {
      if (targetAddressResolveSeqRef.current === requestSeq) {
        targetAddressResolveSeqRef.current += 1;
      }
    };
  }, [currentNode, isConnected, p2pSession.activeBootstrapAddr, peerId, resolveDialableAddress, targetPeer]);

  useEffect(() => {
    if (!isConnected || currentNode == null || targetPeer == null) {
      lastResolvedTruthContextRef.current = null;
      setPeerTruthStatus("idle");
      setPeerTruthErrorMessage(null);
      return;
    }

    if (targetAddress == null) {
      lastResolvedTruthContextRef.current = null;
      setPeerTruthStatus("error");
      setPeerTruthErrorMessage("目标节点当前没有 browser-dialable multiaddr，无法读取节点能力。");
      return;
    }

    const node = currentNode;
    const address = targetAddress;
    const nextTruthContext = {
      controllerPeerId: currentNodePeerId,
      targetAddress: address,
    };

    let cancelled = false;

    async function loadPeerTruth() {
      if (refreshKey === 0 && capabilityTruth != null) {
        const lastResolvedTruthContext = lastResolvedTruthContextRef.current;
        if (
          lastResolvedTruthContext == null ||
          (lastResolvedTruthContext.controllerPeerId === nextTruthContext.controllerPeerId &&
            lastResolvedTruthContext.targetAddress === nextTruthContext.targetAddress)
        ) {
          lastResolvedTruthContextRef.current = nextTruthContext;
          setPeerTruthStatus("ready");
          setPeerTruthErrorMessage(null);
          return;
        }
      }

      setPeerTruthStatus("loading");
      setPeerTruthErrorMessage(null);

      try {
        rememberPeerTruth(
          peerId,
          await requestPeerCapabilityTruth({
            node,
            address,
            peerId,
          }),
        );
        if (cancelled) {
          return;
        }
        lastResolvedTruthContextRef.current = nextTruthContext;
        setPeerTruthStatus("ready");
        if (refreshKey !== 0) {
          setRefreshKey(0);
        }
      } catch (error) {
        if (cancelled) {
          return;
        }
        setPeerTruthStatus("error");
        setPeerTruthErrorMessage(error instanceof Error ? error.message : String(error));
      }
    }

    void loadPeerTruth();

    return () => {
      cancelled = true;
    };
  }, [
    capabilityTruth,
    currentNode,
    currentNodePeerId,
    isConnected,
    peerId,
    refreshKey,
    rememberPeerTruth,
    targetAddress,
    targetPeer?.peerId,
  ]);

  const featureLabels = useMemo(() => {
    return listPeerFeatureLabels(capabilityTruth?.vnc, capabilityTruth?.remoteControl);
  }, [capabilityTruth?.remoteControl, capabilityTruth?.vnc]);
  const visibleMultiaddrs = useMemo(() => targetPeer?.multiaddrs ?? [], [targetPeer]);

  return {
    ...p2pSession,
    capabilityTruth,
    canOpenAndroid: canOpenAndroidView(capabilityTruth?.remoteControl),
    canOpenVnc: supportsVncView(capabilityTruth?.vnc),
    featureLabels,
    hasPeerTruthError,
    isPeerTruthLoading,
    peerId,
    peerTruthErrorMessage,
    peerTruthStatus,
    refreshPeerTruth: () => setRefreshKey((current) => current + 1),
    targetAddress,
    targetPeer,
    visibleMultiaddrs,
  };
}

function useMemoTargetPeer(peerCandidates: ReturnType<typeof useP2PSession>["peerCandidates"], peerId: string) {
  return useMemo(
    () => peerCandidates.find((candidate) => candidate.peerId === peerId) ?? null,
    [peerCandidates, peerId],
  );
}
