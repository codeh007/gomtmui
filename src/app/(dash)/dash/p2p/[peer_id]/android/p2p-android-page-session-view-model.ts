import type { CapabilityState } from "@/lib/p2p/discovery-contracts";
import type { NativeRemoteV2WebRtcStartPayload } from "@/lib/p2p/worker-control";
import type { buildP2PAndroidSessionModel } from "./android-session-model";
import type { AndroidRemoteMode, NativeRemoteV2ViewState } from "./use-p2p-android-page-session";

type CapabilityTruthLike = {
  remoteControl?: {
    capabilities?: {
      nativeRemoteV2?: CapabilityState;
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

export function resolvePreferredNativeRemoteMode(input: {
  browserSupported: boolean;
  capabilityTruth: CapabilityTruthLike | null;
}): AndroidRemoteMode {
  if (!input.browserSupported) {
    return "v1";
  }
  if (input.capabilityTruth == null) {
    return "v2";
  }

  const nativeCapability =
    input.capabilityTruth.remoteControl?.capabilities?.nativeRemoteV2WebRTC ??
    input.capabilityTruth.remoteControl?.capabilities?.nativeRemoteV2;
  const state = nativeCapability?.state?.trim().toLowerCase();
  if (state == null || state === "") {
    return "v1";
  }
  if (!["available", "streaming"].includes(state)) {
    return "v1";
  }
  return "v2";
}

export function deriveNativeRemoteV2Capability(input: {
  availability: ReturnType<typeof buildP2PAndroidSessionModel>["availability"];
  capabilityTruth: CapabilityTruthLike | null;
  errorMessage: string | null;
}) {
  const capability = input.capabilityTruth?.remoteControl?.capabilities?.nativeRemoteV2;
  const webrtcCapability = input.capabilityTruth?.remoteControl?.capabilities?.nativeRemoteV2WebRTC;
  if (webrtcCapability?.state?.trim()) {
    return webrtcCapability satisfies CapabilityState;
  }
  if (capability?.state?.trim()) {
    return capability satisfies CapabilityState;
  }

  switch (input.availability) {
    case "available":
      return { state: "available" } satisfies CapabilityState;
    case "adb_endpoint_unavailable":
      return { reason: "adb_endpoint_unavailable", state: "host_not_ready" } satisfies CapabilityState;
    case "unsupported_browser":
      return { reason: "browser_unsupported", state: "unavailable" } satisfies CapabilityState;
    case "controller_occupied":
      return { reason: "controller_occupied", state: "unavailable" } satisfies CapabilityState;
    case "reconnecting":
    case "preparing":
      return { reason: "awaiting_stream_runtime", state: "host_not_ready" } satisfies CapabilityState;
    case "session_error":
    default:
      return {
        reason: input.errorMessage?.trim() || "session_error",
        state: "error",
      } satisfies CapabilityState;
  }
}

export function buildNativeRemoteV2ViewState(input: {
  availability: ReturnType<typeof buildP2PAndroidSessionModel>["availability"];
  capabilityTruth: CapabilityTruthLike | null;
  errorMessage: string | null;
  previous?: NativeRemoteV2ViewState;
  webrtc?: NativeRemoteV2WebRtcStartPayload;
}): NativeRemoteV2ViewState {
  const session = input.capabilityTruth?.remoteControl?.nativeRemoteV2WebRTCSession;

  return {
    ...input.previous,
    capability: deriveNativeRemoteV2Capability({
      availability: input.availability,
      capabilityTruth: input.capabilityTruth,
      errorMessage: input.errorMessage,
    }),
    sessionId: session?.sessionId,
    sessionLastError: session?.lastError,
    sessionState: session?.state,
    sessionTopology: session?.topology,
    webrtc: input.webrtc ?? input.previous?.webrtc,
  };
}
