import type { NativeViewportSessionLike, StreamStatus } from "./p2p-android-native-v2-webrtc-panel-shared";
import { buildDirectExperimentViewModel, type P2PAndroidDirectExperimentView } from "./direct-experiment-view-model";
import type { AndroidRemoteStatusView, AndroidSessionInfoItem } from "./p2p-android-viewport-support";

export function buildNativeV2DirectExperiment(
  session: NativeViewportSessionLike,
): P2PAndroidDirectExperimentView | undefined {
  return buildDirectExperimentViewModel({
    candidatePairSummary: session.candidatePairSummary,
    directEvidenceSummary: session.directEvidenceSummary,
    lastError: session.lastError,
    lastResult: session.lastResult,
    runDirectExperiment: session.runDirectExperiment,
    state: session.state,
  });
}

export function buildNativeV2SessionInfoItems(params: {
  peerId: string;
  streamStatus: StreamStatus;
  videoHeight: number;
  videoWidth: number;
}): AndroidSessionInfoItem[] {
  const { peerId, streamStatus, videoHeight, videoWidth } = params;
  return [
    { label: "Peer ID", value: peerId },
    { label: "模式", value: "原生" },
    { label: "状态", value: streamStatus },
    { label: "画面尺寸", value: `${videoWidth} x ${videoHeight}` },
  ];
}

export function buildNativeV2SessionDebugItems(params: {
  lastError: string | null;
  session: NativeViewportSessionLike;
}): AndroidSessionInfoItem[] {
  const { lastError, session } = params;
  return [
    { label: "targetAddress", value: session.targetAddress || "未就绪" },
    { label: "sessionId", value: session.nativeRemoteV2.sessionId || "-" },
    { label: "sessionState", value: session.nativeRemoteV2.sessionState || "-" },
    {
      label: "topology",
      value: session.nativeRemoteV2.sessionTopology || session.nativeRemoteV2.webrtc?.topology || "-",
    },
    { label: "lastError", value: lastError || session.nativeRemoteV2.sessionLastError || "-" },
  ];
}

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

export function createNativeV2UnavailableHint(title: string) {
  return {
    detail: title,
    op: "rotate" as const,
    title,
    tone: "muted" as const,
  };
}
