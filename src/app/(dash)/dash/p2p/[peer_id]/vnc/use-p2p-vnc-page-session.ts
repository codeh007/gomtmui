"use client";

import { useMemo } from "react";
import { useP2PPeerPageSession } from "../use-p2p-peer-page-session";
import { buildVncSessionModel } from "./vnc-session-model";

export function useP2PVncPageSession(peerId: string) {
  const peerSession = useP2PPeerPageSession(peerId);
  const targetSessionError = peerSession.peerTruthErrorMessage ?? peerSession.errorMessage;

  return useMemo(
    () => ({
      ...peerSession,
      model: buildVncSessionModel({
        peerId,
        peerSession: {
          peerId,
          peerTruth: peerSession.capabilityTruth,
          peerTruthErrorMessage: peerSession.peerTruthErrorMessage,
          peerTruthStatus: peerSession.peerTruthStatus,
        },
      }),
      peerId,
      targetSessionError,
    }),
    [peerId, peerSession, targetSessionError],
  );
}
