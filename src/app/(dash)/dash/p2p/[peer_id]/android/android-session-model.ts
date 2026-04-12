import {
  type PeerCandidate,
  type PeerCapabilityTruth,
  supportsAndroidRemoteControl,
} from "@/lib/p2p/discovery-contracts";
import type { P2PStatus } from "../../use-p2p-session";

export type P2PAndroidTransportPhase =
  | "idle"
  | "waiting_for_target"
  | "loading_device"
  | "controller_occupied"
  | "reconnecting"
  | "ready"
  | "unsupported_browser"
  | "session_error"
  | "error";

export type P2PAndroidAvailability =
  | "preparing"
  | "available"
  | "adb_endpoint_unavailable"
  | "controller_occupied"
  | "unsupported_browser"
  | "reconnecting"
  | "session_error";

export type P2PAndroidAvailabilityMeta = {
  label: string;
  tone: "default" | "secondary" | "destructive";
};

export type AndroidNativeRemoteV2AvailabilityMeta = {
  label: string;
  tone: "muted" | "success" | "warning";
  detail: string;
};

export type P2PAndroidSessionPhase =
  | "connecting"
  | "waiting_for_target"
  | "loading_device"
  | "adb_endpoint_unavailable"
  | "controller_occupied"
  | "unsupported_browser"
  | "reconnecting"
  | "ready"
  | "session_error";

export type P2PAndroidSessionModel = {
  phase: P2PAndroidSessionPhase;
  availability: P2PAndroidAvailability;
};

export type BuildP2PAndroidSessionModelInput = {
  browserSupported?: boolean;
  capabilityTruth: PeerCapabilityTruth | null;
  controllerPeerId?: string | null;
  networkStatus: P2PStatus;
  errorMessage: string | null;
  targetPeer: PeerCandidate | null;
  transportPhase?: P2PAndroidTransportPhase;
};

export type ResolveP2PAndroidPagePreflightStateInput = {
  browserSupported: boolean;
  isConnected: boolean;
  isLoadingDescriptor: boolean;
  capabilityTruth: PeerCapabilityTruth | null;
  peerTruthErrorMessage: string | null;
  peerTruthStatus: "idle" | "loading" | "ready" | "error";
  targetAddress: string | null;
  targetPeer: PeerCandidate | null;
};

export function buildP2PAndroidStreamSessionKey(input: {
  isConnected: boolean;
  peerId: string | null | undefined;
  refreshNonce: number;
  targetAddress: string | null | undefined;
}) {
  return `${input.isConnected ? "1" : "0"}:${input.peerId?.trim() ?? ""}:${input.targetAddress?.trim() ?? ""}:${input.refreshNonce}`;
}

function hasAndroidControl(capabilityTruth: PeerCapabilityTruth | null) {
  return supportsAndroidRemoteControl(capabilityTruth?.remoteControl);
}

function normalizeState(value: string | null | undefined) {
  return value?.trim().toLowerCase() ?? "";
}

function detectPeerBlocker(
  capabilityTruth: PeerCapabilityTruth | null,
  controllerPeerId: string | null | undefined,
): Extract<P2PAndroidSessionPhase, "adb_endpoint_unavailable" | "controller_occupied"> | null {
  const remoteControl = capabilityTruth?.remoteControl;
  if (!supportsAndroidRemoteControl(remoteControl) || remoteControl == null) {
    return null;
  }

  if (normalizeState(remoteControl.session.controllerState) === "occupied") {
    const activeControllerPeerId = normalizeState(remoteControl.session.activeControllerPeerId);
    const normalizedControllerPeerId = normalizeState(controllerPeerId);
    if (
      activeControllerPeerId !== "" &&
      normalizedControllerPeerId !== "" &&
      activeControllerPeerId === normalizedControllerPeerId
    ) {
      return null;
    }
    return "controller_occupied";
  }

  const adbState = normalizeState(remoteControl.capabilities.adbTunnel.state);
  const scrcpyState = normalizeState(remoteControl.capabilities.scrcpy.state);
  const scrcpyReason = normalizeState(remoteControl.capabilities.scrcpy.reason);
  if (
    adbState !== "available" ||
    scrcpyState === "unavailable" ||
    scrcpyState === "host_not_ready" ||
    scrcpyReason === "unsupported"
  ) {
    return "adb_endpoint_unavailable";
  }

  return null;
}

export function resolveP2PAndroidPagePreflightState(input: ResolveP2PAndroidPagePreflightStateInput): {
  errorMessage: string | null;
  transportPhase: P2PAndroidTransportPhase;
} | null {
  if (!input.isConnected) {
    return {
      errorMessage: null,
      transportPhase: "idle",
    };
  }

  // if (input.targetPeer == null) {
  //   return {
  //     errorMessage: "目标 Android 节点尚未出现在 discovery 结果中。",
  //     transportPhase: "waiting_for_target",
  //   };
  // }

  if (input.isLoadingDescriptor) {
    return {
      errorMessage: null,
      transportPhase: "loading_device",
    };
  }

  if (input.peerTruthStatus === "error") {
    return {
      errorMessage: input.peerTruthErrorMessage ?? "目标节点能力读取失败。",
      transportPhase: "error",
    };
  }

  if (input.targetAddress == null) {
    return {
      errorMessage: "目标节点尚未暴露可供浏览器直连的 multiaddr。",
      transportPhase: "waiting_for_target",
    };
  }

  if (!supportsAndroidRemoteControl(input.capabilityTruth?.remoteControl)) {
    return {
      errorMessage: "目标节点尚未声明 Android 远控能力。",
      transportPhase: "error",
    };
  }

  if (!input.browserSupported) {
    return {
      errorMessage: "当前浏览器不支持 Android scrcpy 远控。请改用 Chromium 桌面浏览器。",
      transportPhase: "unsupported_browser",
    };
  }

  return null;
}

export function getP2PAndroidAvailabilityMeta(availability: P2PAndroidAvailability): P2PAndroidAvailabilityMeta {
  switch (availability) {
    case "available":
      return { label: "可用", tone: "default" };
    case "adb_endpoint_unavailable":
      return { label: "ADB 未就绪", tone: "destructive" };
    case "controller_occupied":
      return { label: "已占用", tone: "destructive" };
    case "unsupported_browser":
      return { label: "浏览器不支持", tone: "destructive" };
    case "reconnecting":
      return { label: "重连中", tone: "secondary" };
    case "session_error":
      return { label: "会话异常", tone: "destructive" };
    case "preparing":
    default:
      return { label: "准备中", tone: "secondary" };
  }
}

export function getAndroidNativeRemoteV2AvailabilityMeta(
  state: string | null | undefined,
  reason?: string | null,
): AndroidNativeRemoteV2AvailabilityMeta {
  const normalizedState = normalizeState(state);
  const normalizedReason = reason?.trim() || undefined;

  switch (normalizedState) {
    case "available":
    case "streaming":
      return {
        detail: normalizedReason ?? "native remote v2 ready",
        label: "可用",
        tone: "success",
      };
    case "permission_required":
      return {
        detail: normalizedReason ?? "screen capture permission required",
        label: "待授权",
        tone: "warning",
      };
    case "host_not_ready":
      return {
        detail: normalizedReason ?? "awaiting stream runtime",
        label: "宿主未就绪",
        tone: "warning",
      };
    default:
      return {
        detail: normalizedReason ?? "native remote v2 unavailable",
        label: "不可用",
        tone: "muted",
      };
  }
}

export function buildP2PAndroidSessionModel(input: BuildP2PAndroidSessionModelInput): P2PAndroidSessionModel {
  if (input.browserSupported === false && hasAndroidControl(input.capabilityTruth)) {
    return { phase: "unsupported_browser", availability: "unsupported_browser" };
  }
  if (input.networkStatus === "peer_candidates_ready" && input.targetPeer == null) {
    return { phase: "waiting_for_target", availability: "preparing" };
  }
  if (input.transportPhase === "waiting_for_target") {
    return { phase: "waiting_for_target", availability: "preparing" };
  }
  if (input.transportPhase === "unsupported_browser") {
    return { phase: "unsupported_browser", availability: "unsupported_browser" };
  }
  if (input.transportPhase === "reconnecting") {
    return { phase: "reconnecting", availability: "reconnecting" };
  }
  if (input.transportPhase === "controller_occupied") {
    return { phase: "controller_occupied", availability: "controller_occupied" };
  }
  if (input.transportPhase === "error" || input.transportPhase === "session_error") {
    return { phase: "session_error", availability: "session_error" };
  }

  const peerBlocker = detectPeerBlocker(input.capabilityTruth, input.controllerPeerId);
  if (peerBlocker != null) {
    return { phase: peerBlocker, availability: peerBlocker };
  }

  if (input.transportPhase === "loading_device") {
    return { phase: "loading_device", availability: "preparing" };
  }

  if (input.transportPhase === "ready") {
    return { phase: "ready", availability: "available" };
  }
  if (
    input.networkStatus === "joining" ||
    input.networkStatus === "discovering" ||
    input.networkStatus === "needs-bootstrap"
  ) {
    return { phase: "connecting", availability: "preparing" };
  }
  if (
    input.networkStatus === "peer_candidates_ready" &&
    input.targetPeer != null &&
    hasAndroidControl(input.capabilityTruth)
  ) {
    return { phase: "ready", availability: "available" };
  }
  return { phase: "session_error", availability: "session_error" };
}
