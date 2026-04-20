"use client";

import { useMemo } from "react";
import { deriveNativeRemoteV2Capability, resolveTargetSessionError } from "./p2p-android-page-session-view-model";
import { useAndroidDirectLane } from "./use-android-direct-lane";
import { useP2PPeerPageSession } from "../use-p2p-peer-page-session";

export function useP2PAndroidPageSession(peerId: string) {
  const peerSession = useP2PPeerPageSession(peerId);
  const targetAddress = peerSession.targetAddress;
  const capabilityTruth = peerSession.capabilityTruth;
  const targetSessionError = resolveTargetSessionError({
    errorMessage: peerSession.errorMessage,
    isConnected: peerSession.isConnected,
    peerTruthErrorMessage: peerSession.peerTruthErrorMessage,
    targetAddress,
  });
  const directLane = useAndroidDirectLane({
    address: targetAddress,
    node: peerSession.getCurrentNode,
    peerId,
  });
  const nativeRemoteV2 = useMemo(
    () => ({
      capability: deriveNativeRemoteV2Capability({
        availability: peerSession.isConnected && targetAddress != null ? "available" : "disconnected",
        capabilityTruth,
        errorMessage: targetSessionError,
      }),
    }),
    [capabilityTruth, peerSession.isConnected, targetAddress, targetSessionError],
  );

  return {
    ...peerSession,
    ...directLane,
    nativeRemoteV2,
    peerId,
    targetAddress,
    targetPeer: peerSession.targetPeer,
    targetSessionError,
  };
}
