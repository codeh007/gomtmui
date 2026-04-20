import type { CapabilityState } from "@/lib/p2p/discovery-contracts";
import type { NativeRemoteV2WebRtcStartPayload } from "@/lib/p2p/worker-control";
import type { NativeRemoteV2ViewState } from "./use-p2p-android-page-session";

type CapabilityTruthLike = {
  remoteControl?: {
    capabilities?: {
      nativeRemoteV2WebRTC?: CapabilityState;
    };
    nativeRemoteV2WebRTCSession?: {
      lastError?: string;
      sessionId?: string;
      state?: string;
      topology?: string;
    };
  };
};

export type AndroidNativeRemoteV2Availability =
  | "available"
  | "disconnected"
  | "error"
  | "permission_required"
  | "streaming"
  | "unavailable";

export type AndroidNativeRemoteV2Phase =
  | "disconnected"
  | "error"
  | "permission_required"
  | "ready"
  | "waiting_for_target";

export type AndroidNativeRemoteV2TransportPhase = "error" | "idle" | "ready" | "waiting_for_target";

export type AndroidNativeRemoteV2SessionModel = {
  availability: AndroidNativeRemoteV2Availability;
  errorMessage: string | null;
  phase: AndroidNativeRemoteV2Phase;
  transportPhase: AndroidNativeRemoteV2TransportPhase;
};

type BuildAndroidNativeRemoteV2SessionModelInput = {
  capabilityTruth: CapabilityTruthLike | null;
  isConnected: boolean;
  networkErrorMessage: string | null;
  peerTruthErrorMessage: string | null;
  targetAddress: string | null;
};

function normalizeCapabilityState(value: string | null | undefined) {
  return value?.trim().toLowerCase() ?? "";
}

function resolveNativeRemoteCapability(capabilityTruth: CapabilityTruthLike | null) {
  return capabilityTruth?.remoteControl?.capabilities?.nativeRemoteV2WebRTC ?? null;
}

export function buildAndroidNativeRemoteV2SessionModel(
  input: BuildAndroidNativeRemoteV2SessionModelInput,
): AndroidNativeRemoteV2SessionModel {
  if (!input.isConnected) {
    return {
      availability: "disconnected",
      errorMessage: null,
      phase: "disconnected",
      transportPhase: "idle",
    };
  }

  if (input.targetAddress == null) {
    return {
      availability: "unavailable",
      errorMessage: "目标节点当前没有 browser-dialable multiaddr。",
      phase: "waiting_for_target",
      transportPhase: "waiting_for_target",
    };
  }

  const capability = resolveNativeRemoteCapability(input.capabilityTruth);
  const capabilityState = normalizeCapabilityState(capability?.state);
  const capabilityReason = capability?.reason?.trim() || null;
  const fallbackError = capabilityReason ?? input.peerTruthErrorMessage ?? input.networkErrorMessage ?? null;

  switch (capabilityState) {
    case "available":
      return {
        availability: "available",
        errorMessage: null,
        phase: "ready",
        transportPhase: "ready",
      };
    case "streaming":
      return {
        availability: "streaming",
        errorMessage: null,
        phase: "ready",
        transportPhase: "ready",
      };
    case "permission_required":
      return {
        availability: "permission_required",
        errorMessage: fallbackError,
        phase: "permission_required",
        transportPhase: "ready",
      };
    case "error":
      return {
        availability: "error",
        errorMessage: fallbackError ?? "native remote v2 error",
        phase: "error",
        transportPhase: "error",
      };
    case "unavailable":
    case "":
    default:
      return {
        availability: "unavailable",
        errorMessage: fallbackError ?? "native remote v2 unavailable",
        phase: "error",
        transportPhase: "error",
      };
  }
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
  availability: AndroidNativeRemoteV2Availability;
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

export function buildNativeRemoteV2ViewState(input: {
  availability: AndroidNativeRemoteV2Availability;
  capabilityTruth: CapabilityTruthLike | null;
  errorMessage: string | null;
  webrtc?: NativeRemoteV2WebRtcStartPayload;
}): NativeRemoteV2ViewState {
  const session = input.capabilityTruth?.remoteControl?.nativeRemoteV2WebRTCSession;

  return {
    capability: deriveNativeRemoteV2Capability({
      availability: input.availability,
      capabilityTruth: input.capabilityTruth,
      errorMessage: input.errorMessage,
    }),
    sessionId: session?.sessionId,
    sessionLastError: session?.lastError,
    sessionState: session?.state,
    sessionTopology: session?.topology,
    webrtc: input.webrtc,
  };
}
