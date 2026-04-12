import { type PeerCandidate, type PeerCapabilityTruth, supportsVncView } from "@/lib/p2p/discovery-contracts";
import type { P2PStatus } from "../../use-p2p-session";

export type P2PVncTransportPhase =
  | "idle"
  | "waiting_for_target"
  | "ensuring_vnc"
  | "opening_stream"
  | "ready"
  | "permission_denied"
  | "disconnected"
  | "error";

export type P2PVncAvailability = "preparing" | "available" | "unavailable" | "permission_denied";

export type P2PVncAvailabilityMeta = {
  label: string;
  tone: "default" | "secondary" | "destructive";
};

export type P2PVncViewportCopy = {
  title: string;
  detail: string;
};

export type P2PVncSessionModel = {
  phase:
    | "connecting"
    | "waiting_for_target"
    | "ensuring_vnc"
    | "opening_stream"
    | "ready"
    | "permission_denied"
    | "disconnected"
    | "error";
  availability: P2PVncAvailability;
};

export type BuildP2PVncSessionModelInput = {
  capabilityTruth: PeerCapabilityTruth | null;
  networkStatus: P2PStatus;
  errorMessage: string | null;
  targetPeer: PeerCandidate | null;
  transportPhase?: P2PVncTransportPhase;
};

function hasVncAccess(capabilityTruth: PeerCapabilityTruth | null) {
  return supportsVncView(capabilityTruth?.vnc);
}

export function getP2PVncUnavailableMessage(capabilityTruth: PeerCapabilityTruth | null) {
  const reason = capabilityTruth?.vnc?.reason?.trim().toLowerCase() ?? "";
  if (reason === "platform_unsupported") {
    return "目标节点所在平台当前不支持桌面 VNC。";
  }
  if (reason === "not_configured") {
    return "目标节点当前未配置桌面 VNC 服务。";
  }
  if (reason === "not_supported") {
    return "目标节点当前不提供桌面 VNC 能力。";
  }
  return "目标节点当前未声明可用的桌面能力。";
}

function isPermissionDenied(params: BuildP2PVncSessionModelInput) {
  if (params.transportPhase === "permission_denied") {
    return true;
  }

  return params.errorMessage?.toLowerCase().includes("permission denied") ?? false;
}

export function getP2PVncAvailabilityMeta(availability: P2PVncAvailability): P2PVncAvailabilityMeta {
  if (availability === "available") {
    return {
      label: "可用",
      tone: "default",
    };
  }

  if (availability === "permission_denied") {
    return {
      label: "拒绝访问",
      tone: "destructive",
    };
  }

  if (availability === "unavailable") {
    return {
      label: "不可用",
      tone: "destructive",
    };
  }

  return {
    label: "准备中",
    tone: "secondary",
  };
}

export function getP2PVncViewportCopy(
  phase: P2PVncSessionModel["phase"],
  errorMessage: string | null,
): P2PVncViewportCopy | null {
  if (phase === "ready") {
    return null;
  }

  if (phase === "permission_denied") {
    return {
      title: "拒绝访问",
      detail: errorMessage ?? "目标节点拒绝了当前桌面会话权限。",
    };
  }

  if (phase === "waiting_for_target") {
    return {
      title: "等待目标设备上线",
      detail: errorMessage ?? "节点上线后自动进入桌面。",
    };
  }

  if (phase === "disconnected") {
    return {
      title: "正在恢复桌面",
      detail: errorMessage ?? "正在恢复连接。",
    };
  }

  if (phase === "error") {
    return {
      title: "桌面连接失败",
      detail: errorMessage ?? "目标桌面会话当前无法自动恢复。",
    };
  }

  return {
    title: "正在准备桌面",
    detail: errorMessage ?? "连接后自动进入桌面。",
  };
}

export function buildP2PVncSessionModel(input: BuildP2PVncSessionModelInput): P2PVncSessionModel {
  if (isPermissionDenied(input)) {
    return {
      phase: "permission_denied",
      availability: "permission_denied",
    };
  }

  if (input.networkStatus === "peer_candidates_ready" && input.targetPeer == null) {
    return {
      phase: "waiting_for_target",
      availability: "preparing",
    };
  }

  if (input.transportPhase === "waiting_for_target") {
    return {
      phase: "waiting_for_target",
      availability: "preparing",
    };
  }

  if (input.transportPhase === "ready") {
    return {
      phase: "ready",
      availability: "available",
    };
  }

  if (input.transportPhase === "opening_stream") {
    return {
      phase: "opening_stream",
      availability: "preparing",
    };
  }

  if (input.transportPhase === "disconnected") {
    return {
      phase: "disconnected",
      availability: "unavailable",
    };
  }

  if (input.transportPhase === "error") {
    return {
      phase: "error",
      availability: "unavailable",
    };
  }

  if (input.networkStatus === "joining" || input.networkStatus === "discovering") {
    return {
      phase: "connecting",
      availability: "preparing",
    };
  }

  if (input.networkStatus === "peer_candidates_ready" && hasVncAccess(input.capabilityTruth)) {
    return {
      phase: "ensuring_vnc",
      availability: "preparing",
    };
  }

  if (input.networkStatus === "needs-bootstrap") {
    return {
      phase: "connecting",
      availability: "preparing",
    };
  }

  return {
    phase: "error",
    availability: "unavailable",
  };
}
