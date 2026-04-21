"use client";

import { useMemo } from "react";
import { deriveNativeRemoteV2Capability, resolveTargetSessionError } from "./p2p-android-page-session-view-model";
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
  const capability = nativeRemoteV2.capability;

  return {
    ...peerSession,
    capability,
    nativeRemoteV2,
    peerId,
    targetAddress,
    targetPeer: peerSession.targetPeer,
    targetSessionError,
  };
}
