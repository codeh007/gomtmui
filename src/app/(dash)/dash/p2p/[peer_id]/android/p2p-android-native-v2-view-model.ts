import type { StreamStatus } from "./p2p-android-native-v2-webrtc-panel-shared";
import type { AndroidRemoteStatusView } from "./p2p-android-viewport-support";

export function buildNativeV2RemoteStatus(params: {
  capabilityDetail: string;
  capabilityState: string;
  streamStatus: StreamStatus;
}): AndroidRemoteStatusView {
  const { capabilityDetail, capabilityState, streamStatus } = params;
  if (streamStatus === "connected") {
    return { detail: "已连接", label: "Connected", showBusyIndicator: false };
  }
  if (streamStatus === "connecting") {
    return { detail: "连接中", label: "Connecting", showBusyIndicator: false };
  }
  if (streamStatus === "error") {
    return { detail: "连接失败", label: "Error", showBusyIndicator: false };
  }
  if (capabilityState === "permission_required") {
    return { detail: capabilityDetail, label: "Unsupported", showBusyIndicator: false };
  }
  if (capabilityState === "host_not_ready" || capabilityState === "connecting" || capabilityState === "starting") {
    return { detail: capabilityDetail, label: "Connecting", showBusyIndicator: false };
  }
  if (capabilityState === "unavailable" || capabilityState === "error") {
    return { detail: capabilityDetail, label: "Error", showBusyIndicator: false };
  }
  return { detail: "准备中", label: "Connecting", showBusyIndicator: false };
}

export function createNativeV2UnavailableHint(detail: string) {
  return {
    detail,
    op: "rotate" as const,
    title: detail,
    tone: "muted" as const,
  };
}
