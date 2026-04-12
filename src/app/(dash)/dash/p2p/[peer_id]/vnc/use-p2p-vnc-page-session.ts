"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { supportsAndroidRemoteControl, supportsVncView } from "@/lib/p2p/discovery-contracts";
import { useP2PPeerPageSession } from "../use-p2p-peer-page-session";
import { buildP2PVncSessionModel, getP2PVncUnavailableMessage, type P2PVncTransportPhase } from "./vnc-session-model";

function isVncExplicitlyUnavailable(vnc: { state?: string } | null | undefined) {
  return (vnc?.state?.trim().toLowerCase() ?? "") === "unavailable";
}

export function useP2PVncPageSession(peerId: string) {
  const peerSession = useP2PPeerPageSession(peerId);
  const isConnected = peerSession.isConnected;
  const [transportPhase, setTransportPhase] = useState<P2PVncTransportPhase>("idle");
  const [targetErrorMessage, setTargetErrorMessage] = useState<string | null>(null);
  const targetAddress = peerSession.targetAddress;
  const targetPeer = peerSession.targetPeer;
  const capabilityTruth = peerSession.capabilityTruth;
  const isLoadingDescriptor = peerSession.isPeerTruthLoading;
  const hasPeerTruthError = peerSession.hasPeerTruthError;
  const blocksVncByPlatform =
    supportsAndroidRemoteControl(capabilityTruth?.remoteControl) && !supportsVncView(capabilityTruth?.vnc);
  const blocksVncByExplicitCapability = isVncExplicitlyUnavailable(capabilityTruth?.vnc);
  const canAttemptLiveVnc =
    peerSession.targetPeer != null &&
    targetAddress != null &&
    !supportsVncView(capabilityTruth?.vnc) &&
    !blocksVncByExplicitCapability &&
    !blocksVncByPlatform;
  const targetAvailabilityKey = `${peerSession.isConnected ? "1" : "0"}:${targetPeer?.peerId ?? ""}:${targetAddress ?? ""}:${capabilityTruth?.vnc?.state ?? ""}:${capabilityTruth?.vnc?.reason ?? ""}:${capabilityTruth?.remoteControl?.platform ?? ""}:${peerSession.peerTruthStatus}`;
  const lastTargetAvailabilityKeyRef = useRef(targetAvailabilityKey);

  useEffect(() => {
    if (!isConnected) {
      if (targetErrorMessage != null) {
        setTargetErrorMessage(null);
      }
      if (transportPhase !== "idle") {
        setTransportPhase("idle");
      }
      return;
    }

    if (peerSession.targetPeer == null) {
      if (targetErrorMessage != null) {
        setTargetErrorMessage(null);
      }
      if (transportPhase !== "waiting_for_target") {
        setTransportPhase("waiting_for_target");
      }
      return;
    }

    if (supportsVncView(capabilityTruth?.vnc)) {
      if (targetErrorMessage != null) {
        setTargetErrorMessage(null);
      }
      if (["waiting_for_target", "error"].includes(transportPhase)) {
        setTransportPhase("idle");
      }
      return;
    }

    if (blocksVncByPlatform || blocksVncByExplicitCapability) {
      const unavailableMessage = getP2PVncUnavailableMessage(capabilityTruth);
      if (targetErrorMessage !== unavailableMessage) {
        setTargetErrorMessage(unavailableMessage);
      }
      if (transportPhase !== "error") {
        setTransportPhase("error");
      }
      return;
    }

    if (canAttemptLiveVnc || isLoadingDescriptor || hasPeerTruthError) {
      if (targetErrorMessage != null) {
        setTargetErrorMessage(null);
      }
      if (["waiting_for_target", "error"].includes(transportPhase)) {
        setTransportPhase("idle");
      }
      return;
    }
  }, [
    blocksVncByExplicitCapability,
    blocksVncByPlatform,
    capabilityTruth,
    canAttemptLiveVnc,
    isConnected,
    isLoadingDescriptor,
    hasPeerTruthError,
    peerSession.peerTruthErrorMessage,
    peerSession.peerTruthStatus,
    peerSession.targetPeer,
    targetAddress,
    targetErrorMessage,
    targetPeer,
    transportPhase,
  ]);

  useEffect(() => {
    const previousKey = lastTargetAvailabilityKeyRef.current;
    lastTargetAvailabilityKeyRef.current = targetAvailabilityKey;
    if (previousKey === targetAvailabilityKey) {
      return;
    }
    if (!isConnected || targetPeer == null || targetAddress == null) {
      return;
    }
    if (blocksVncByPlatform || blocksVncByExplicitCapability) {
      return;
    }
    if (!["waiting_for_target", "disconnected", "error"].includes(transportPhase)) {
      return;
    }

    if (targetErrorMessage != null) {
      setTargetErrorMessage(null);
    }
    setTransportPhase("idle");
  }, [
    blocksVncByExplicitCapability,
    blocksVncByPlatform,
    isConnected,
    targetAddress,
    targetAvailabilityKey,
    targetErrorMessage,
    targetPeer,
    transportPhase,
  ]);

  const modelTargetPeer = useMemo(() => {
    if (targetAddress == null) {
      return null;
    }
    if (canAttemptLiveVnc || isLoadingDescriptor || hasPeerTruthError) {
      return null;
    }
    return targetPeer;
  }, [canAttemptLiveVnc, hasPeerTruthError, isLoadingDescriptor, targetAddress, targetPeer]);
  const modelCapabilityTruth = useMemo(() => {
    if (targetAddress == null) {
      return null;
    }
    if (canAttemptLiveVnc || isLoadingDescriptor || hasPeerTruthError) {
      return null;
    }
    return capabilityTruth;
  }, [canAttemptLiveVnc, capabilityTruth, hasPeerTruthError, isLoadingDescriptor, targetAddress]);

  const model = useMemo(
    () =>
      buildP2PVncSessionModel({
        capabilityTruth: modelCapabilityTruth,
        networkStatus: peerSession.status,
        errorMessage: targetErrorMessage ?? peerSession.errorMessage,
        targetPeer: modelTargetPeer,
        transportPhase,
      }),
    [
      modelCapabilityTruth,
      modelTargetPeer,
      peerSession.errorMessage,
      peerSession.status,
      targetErrorMessage,
      transportPhase,
    ],
  );

  return {
    ...peerSession,
    model,
    peerId,
    setTargetErrorMessage,
    setTransportPhase,
    targetAddress,
    targetPeer,
    targetSessionError: targetErrorMessage,
    transportPhase,
  };
}
