import type { PeerCapabilityTruth } from "@/lib/p2p/discovery-contracts";

type PeerSessionLike = {
  peerId: string;
  peerTruth: PeerCapabilityTruth | null;
  peerTruthErrorMessage: string | null;
  peerTruthStatus: "idle" | "loading" | "ready" | "error";
};

export type VncSessionModel = {
  peerId: string;
  peerTruth: PeerCapabilityTruth | null;
  peerTruthErrorMessage: string | null;
  peerTruthStatus: "idle" | "loading" | "ready" | "error";
  availability: "preparing" | "available" | "unavailable";
};

export function buildVncSessionModel(input: { peerId: string; peerSession: PeerSessionLike }): VncSessionModel {
  return {
    peerId: input.peerId,
    peerTruth: input.peerSession.peerTruth,
    peerTruthErrorMessage: input.peerSession.peerTruthErrorMessage,
    peerTruthStatus: input.peerSession.peerTruthStatus,
    availability: input.peerSession.peerTruthStatus === "ready" ? "unavailable" : "preparing",
  };
}

export function getVncAvailabilityMeta(availability: VncSessionModel["availability"]) {
  if (availability === "available") {
    return { label: "可用", tone: "default" as const };
  }
  if (availability === "unavailable") {
    return { label: "不可用", tone: "destructive" as const };
  }
  return { label: "准备中", tone: "secondary" as const };
}
