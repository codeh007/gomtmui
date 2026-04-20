import type { CapabilityState } from "@/lib/p2p/discovery-contracts";

type CapabilityTruthLike = {
  remoteControl?: {
    capabilities?: {
      nativeRemoteV2WebRTC?: CapabilityState;
    };
  };
};

function resolveNativeRemoteCapability(capabilityTruth: CapabilityTruthLike | null) {
  return capabilityTruth?.remoteControl?.capabilities?.nativeRemoteV2WebRTC ?? null;
}

function hasCapabilityState(capability: CapabilityState | null | undefined): capability is CapabilityState {
  return (capability?.state?.trim() ?? "") !== "";
}

function normalizeCapability(capability: CapabilityState): CapabilityState {
  return {
    reason: capability.reason?.trim() || undefined,
    state: capability.state?.trim() || undefined,
  };
}

export function deriveNativeRemoteV2Capability(input: {
  availability: "available" | "disconnected" | "error" | "permission_required" | "streaming" | "unavailable";
  capabilityTruth: CapabilityTruthLike | null;
  errorMessage: string | null;
}) {
  const capability = resolveNativeRemoteCapability(input.capabilityTruth);
  if (hasCapabilityState(capability)) {
    return normalizeCapability(capability);
  }
  if (input.errorMessage?.trim()) {
    return {
      reason: input.errorMessage.trim(),
      state: "unavailable",
    } satisfies CapabilityState;
  }
  if (input.availability === "available" || input.availability === "streaming") {
    return { state: input.availability } satisfies CapabilityState;
  }
  if (input.availability === "permission_required") {
    return {
      reason: "screen_capture_not_granted",
      state: "permission_required",
    } satisfies CapabilityState;
  }
  if (input.availability === "error") {
    return {
      reason: input.errorMessage?.trim() || "native_remote_v2_error",
      state: "error",
    } satisfies CapabilityState;
  }
  if (input.availability === "disconnected") {
    return {
      reason: "not_connected",
      state: "unavailable",
    } satisfies CapabilityState;
  }
  return {
    reason: "native_remote_v2_unavailable",
    state: "unavailable",
  } satisfies CapabilityState;
}
