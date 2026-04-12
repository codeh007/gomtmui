import type { AndroidDeviceOpState, AndroidScrcpySessionSnapshot } from "@/lib/p2p/android-scrcpy-session";
import type { PeerCandidate, PeerCapabilityTruth } from "@/lib/p2p/discovery-contracts";
import type { P2PAndroidDirectExperimentView } from "./p2p-android-viewport-stage";
import type { AndroidDeviceOpHint, AndroidSessionInfoItem } from "./p2p-android-viewport-support";
import { describeDeviceOpState, formatConnectElapsed } from "./p2p-android-viewport-support";
import type { AndroidDirectLaneState } from "./use-android-direct-lane";

export function buildSessionInfoItems(params: {
  capabilityTruth: PeerCapabilityTruth | null;
  targetPeerId: string;
  viewportHeight: number;
  viewportWidth: number;
}): AndroidSessionInfoItem[] {
  const { capabilityTruth, targetPeerId, viewportHeight, viewportWidth } = params;
  return [
    { label: "Peer ID", value: targetPeerId || "unknown" },
    { label: "平台", value: capabilityTruth?.remoteControl?.platform ?? "unknown" },
    {
      label: "ADB 状态",
      value: capabilityTruth?.remoteControl?.capabilities.adbTunnel.state ?? "unknown",
    },
    {
      label: "scrcpy 状态",
      value: capabilityTruth?.remoteControl?.capabilities.scrcpy.state ?? "unknown",
    },
    {
      label: "控制状态",
      value: capabilityTruth?.remoteControl?.session.controllerState ?? "unknown",
    },
    { label: "视口尺寸", value: `${viewportWidth} x ${viewportHeight}` },
  ];
}

export function buildSessionDebugItems(params: {
  candidateMultiaddrs: PeerCandidate["multiaddrs"] | undefined;
  connectElapsedMs: AndroidScrcpySessionSnapshot["connectElapsedMs"];
  controllerPeerId: string | null;
  performanceLabel: string;
  supportedBrowser: boolean;
  targetAddress: string | null;
  targetSessionError: string | null;
  transportPhase: string;
}): AndroidSessionInfoItem[] {
  const {
    candidateMultiaddrs,
    connectElapsedMs,
    controllerPeerId,
    performanceLabel,
    supportedBrowser,
    targetAddress,
    targetSessionError,
    transportPhase,
  } = params;

  return [
    { label: "preflightPhase", value: transportPhase },
    { label: "targetAddress", value: targetAddress || "未就绪" },
    { label: "candidateMultiaddrs", value: candidateMultiaddrs?.join(" | ") || "未记录" },
    { label: "controllerPeerId", value: controllerPeerId || "unknown" },
    { label: "画质档位", value: performanceLabel },
    { label: "连接耗时", value: formatConnectElapsed(connectElapsedMs) },
    {
      label: "browserSupport",
      value: supportedBrowser ? "Chromium / WebCodecs 已就绪" : "当前浏览器不支持 Android scrcpy",
    },
    { label: "preflightError", value: targetSessionError || "无" },
  ];
}

export function buildDirectExperimentView(params: {
  candidatePairSummary?: string | null;
  directEvidenceSummary?: string | null;
  lastError?: string | null;
  lastResult?: unknown;
  runDirectExperiment?: () => Promise<{ path: string; reason?: string }>;
  state?: AndroidDirectLaneState;
}): P2PAndroidDirectExperimentView | undefined {
  const { candidatePairSummary, directEvidenceSummary, lastError, lastResult, runDirectExperiment, state } = params;
  if (runDirectExperiment == null && lastResult == null && lastError == null && state == null) {
    return undefined;
  }

  return {
    candidatePairSummary: candidatePairSummary ?? "尚无 candidate pair",
    canRun: runDirectExperiment != null,
    directEvidenceSummary: directEvidenceSummary ?? "尚无 direct 证据",
    lastError: lastError ?? null,
    lastResult: lastResult ?? null,
    onRun: runDirectExperiment ?? (() => undefined),
    state: state ?? "idle",
  };
}

export function buildDeviceOpHints(params: {
  controlsEnabled: boolean;
  clipboardState: AndroidDeviceOpState;
  rotateState: AndroidDeviceOpState;
  screenshotState: AndroidDeviceOpState;
}): {
  clipboardHint: AndroidDeviceOpHint;
  rotateHint: AndroidDeviceOpHint;
  screenshotHint: AndroidDeviceOpHint;
} {
  const { controlsEnabled, clipboardState, rotateState, screenshotState } = params;
  return {
    clipboardHint: describeDeviceOpState("writeClipboard", clipboardState, { controlsEnabled }),
    rotateHint: describeDeviceOpState("rotate", rotateState, { controlsEnabled }),
    screenshotHint: describeDeviceOpState("captureScreenshot", screenshotState, { controlsEnabled }),
  };
}
