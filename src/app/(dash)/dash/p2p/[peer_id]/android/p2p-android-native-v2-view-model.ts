import type { NativeViewportSessionLike, StreamStatus } from "./p2p-android-native-v2-webrtc-panel-shared";
import { buildDirectExperimentViewModel, type P2PAndroidDirectExperimentView } from "./direct-experiment-view-model";
import type { AndroidRemoteStatusView } from "./p2p-android-viewport-support";

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

export function buildNativeV2SessionInfoItems(params: {
  peerId: string;
  streamStatus: StreamStatus;
  videoHeight: number;
  videoWidth: number;
}) {
  return [
    { label: "Peer ID", value: params.peerId },
    { label: "模式", value: "原生" },
    { label: "状态", value: params.streamStatus },
    { label: "画面尺寸", value: `${params.videoWidth} x ${params.videoHeight}` },
  ];
}

export function buildNativeV2UnavailableHint(detail: string) {
  return {
    detail,
    op: "rotate" as const,
    title: detail,
    tone: "muted" as const,
  };
}
