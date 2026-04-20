"use client";

import { useMemo } from "react";
import type { CapabilityState } from "@/lib/p2p/discovery-contracts";
import type { NativeRemoteV2WebRtcStartPayload } from "@/lib/p2p/worker-control";
import { useP2PPeerPageSession } from "../use-p2p-peer-page-session";
import {
  buildAndroidNativeRemoteV2SessionModel,
  buildNativeRemoteV2ViewState,
} from "./p2p-android-page-session-view-model";
import { useAndroidDirectLane } from "./use-android-direct-lane";

export type NativeRemoteV2ViewState = {
  capability: CapabilityState;
  webrtc?: NativeRemoteV2WebRtcStartPayload;
};

export function useP2PAndroidPageSession(peerId: string) {
  const peerSession = useP2PPeerPageSession(peerId);
  const targetAddress = peerSession.targetAddress;
  const targetPeer = peerSession.targetPeer;
  const capabilityTruth = peerSession.capabilityTruth;
  const model = useMemo(
    () =>
      buildAndroidNativeRemoteV2SessionModel({
        capabilityTruth,
        isConnected: peerSession.isConnected,
        networkErrorMessage: peerSession.errorMessage,
        peerTruthErrorMessage: peerSession.peerTruthErrorMessage,
        targetAddress,
      }),
    [capabilityTruth, peerSession.errorMessage, peerSession.isConnected, peerSession.peerTruthErrorMessage, targetAddress],
  );
  const targetSessionError = model.errorMessage;
  const directLane = useAndroidDirectLane({
    address: targetAddress,
    node: peerSession.getCurrentNode,
    peerId,
  });

  const nativeRemoteV2 = useMemo(
    () =>
      buildNativeRemoteV2ViewState({
        availability: model.availability,
        capabilityTruth,
        errorMessage: targetSessionError,
      }),
    [capabilityTruth, model.availability, targetSessionError],
  );

    return {
      ...peerSession,
      ...directLane,
      model,
      nativeRemoteV2,
      peerId,
      targetAddress,
      targetPeer,
      targetSessionError,
      transportPhase: model.transportPhase,
    };
}
