"use client";

import { useEffect, useMemo, useState } from "react";
import type { CapabilityState } from "@/lib/p2p/discovery-contracts";
import type { BrowserNodeLike } from "@/lib/p2p/libp2p-stream";
import type { NativeRemoteV2WebRtcStartPayload } from "@/lib/p2p/worker-control";
import { useP2PPeerPageSession } from "../use-p2p-peer-page-session";
import { buildP2PAndroidSessionModel, resolveP2PAndroidPagePreflightState } from "./android-session-model";
import { supportsAndroidScrcpyBrowser } from "./browser-capability";
import { buildNativeRemoteV2ViewState, resolvePreferredNativeRemoteMode } from "./p2p-android-page-session-view-model";
import { useAndroidDirectLane } from "./use-android-direct-lane";

export type AndroidRemoteMode = "v1" | "v2";

export type NativeRemoteV2ViewState = {
  capability: CapabilityState;
  sessionId?: string;
  sessionLastError?: string;
  sessionState?: string;
  sessionTopology?: string;
  webrtc?: NativeRemoteV2WebRtcStartPayload;
};

type BrowserNodePeerIdLike =
  | string
  | {
      toString: () => string;
    };

type BrowserNodeIdentityLike = BrowserNodeLike & {
  id?: BrowserNodePeerIdLike;
  peerId?: BrowserNodePeerIdLike;
};

function resolveBrowserControllerPeerId(node: BrowserNodeLike | null) {
  if (node == null) {
    return null;
  }

  const identityNode = node as BrowserNodeIdentityLike;
  const rawPeerId = identityNode.peerId ?? identityNode.id;
  if (typeof rawPeerId === "string") {
    const normalizedPeerId = rawPeerId.trim();
    return normalizedPeerId === "" ? null : normalizedPeerId;
  }
  if (rawPeerId != null && typeof rawPeerId.toString === "function") {
    const normalizedPeerId = rawPeerId.toString().trim();
    return normalizedPeerId === "" ? null : normalizedPeerId;
  }

  return null;
}

export function useP2PAndroidPageSession(peerId: string) {
  const peerSession = useP2PPeerPageSession(peerId);
  const isConnected = peerSession.isConnected;
  const targetAddress = peerSession.targetAddress;
  const targetPeer = peerSession.targetPeer;
  const capabilityTruth = peerSession.capabilityTruth;
  const controllerPeerId = resolveBrowserControllerPeerId(peerSession.getCurrentNode());
  const isLoadingDescriptor = peerSession.isPeerTruthLoading;
  const [browserSupported, setBrowserSupported] = useState<boolean | null>(null);
  useEffect(() => {
    setBrowserSupported(supportsAndroidScrcpyBrowser());
  }, []);
  const resolvedBrowserSupported = browserSupported ?? true;
  const preflightState = useMemo(
    () =>
      resolveP2PAndroidPagePreflightState({
        browserSupported: resolvedBrowserSupported,
        capabilityTruth,
        isConnected,
        isLoadingDescriptor,
        peerTruthErrorMessage: peerSession.peerTruthErrorMessage,
        peerTruthStatus: peerSession.peerTruthStatus,
        targetAddress,
        targetPeer,
      }),
    [
      resolvedBrowserSupported,
      capabilityTruth,
      isConnected,
      isLoadingDescriptor,
      peerSession.peerTruthErrorMessage,
      peerSession.peerTruthStatus,
      targetAddress,
      targetPeer,
    ],
  );

  const transportPhase = preflightState?.transportPhase ?? "ready";
  const targetSessionError = preflightState?.errorMessage ?? null;
  const directLane = useAndroidDirectLane({
    address: targetAddress,
    node: peerSession.getCurrentNode,
    peerId,
  });

  const model = useMemo(
    () =>
      buildP2PAndroidSessionModel({
        controllerPeerId,
        capabilityTruth,
        networkStatus: peerSession.status,
        errorMessage: targetSessionError ?? peerSession.errorMessage,
        browserSupported: resolvedBrowserSupported,
        targetPeer: isLoadingDescriptor ? null : targetPeer,
        transportPhase,
      }),
    [
      resolvedBrowserSupported,
      capabilityTruth,
      controllerPeerId,
      isLoadingDescriptor,
      peerSession.errorMessage,
      peerSession.status,
      targetSessionError,
      targetPeer,
      transportPhase,
    ],
  );
  const preferredMode = resolvePreferredNativeRemoteMode({
    browserSupported: resolvedBrowserSupported,
    capabilityTruth,
  });
  const [nativeRemoteV2, setNativeRemoteV2] = useState<NativeRemoteV2ViewState>(() =>
    buildNativeRemoteV2ViewState({
      availability: model.availability,
      capabilityTruth,
      errorMessage: targetSessionError ?? peerSession.errorMessage,
    }),
  );

  useEffect(() => {
    setNativeRemoteV2((current) =>
      buildNativeRemoteV2ViewState({
        availability: model.availability,
        capabilityTruth,
        errorMessage: targetSessionError ?? peerSession.errorMessage,
        previous: current,
      }),
    );
  }, [capabilityTruth, model.availability, peerSession.errorMessage, targetSessionError]);

  useEffect(() => {
    setNativeRemoteV2((current) => ({
      ...current,
      sessionId: undefined,
      sessionLastError: undefined,
      sessionState: undefined,
      sessionTopology: undefined,
      webrtc: undefined,
    }));
  }, [peerId, targetAddress]);

  return {
    ...peerSession,
    controllerPeerId,
    ...directLane,
    model,
    nativeRemoteV2,
    peerId,
    preferredMode,
    refreshPeerTruth: peerSession.refreshPeerTruth,
    targetAddress,
    targetPeer,
    targetSessionError,
    transportPhase,
  };
}
