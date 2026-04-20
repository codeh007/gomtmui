"use client";

import { type PointerEvent as ReactPointerEvent, useEffect, useRef, useState } from "react";
import { AndroidNativeV2StatusOverlay } from "./android-native-v2-status-overlay";
import { getAndroidNativeRemoteV2AvailabilityMeta } from "./android-session-model";
import { buildDirectExperimentViewModel } from "./direct-experiment-view-model";
import { getBrowserNodeInstanceKey, type NativeCanvasPoint } from "./p2p-android-native-v2-webrtc-panel-utils";
import { createNativeV2ActionController, createNativeV2PointerHandlers } from "./p2p-android-native-v2-panel-actions";
import { createNativeV2LifecycleController } from "./p2p-android-native-v2-lifecycle";
import { buildNativeV2RemoteStatus, createNativeV2UnavailableHint } from "./p2p-android-native-v2-view-model";
import type { NativeViewportSessionLike, StreamStatus } from "./p2p-android-native-v2-webrtc-panel-shared";
import { AndroidDeviceNavigationBar } from "./android-device-navigation-bar";
import { AndroidControlRail } from "./p2p-android-viewport-control-rail";

type NativeViewportSession = NativeViewportSessionLike;

export function P2PAndroidNativeV2WebRtcPanel({ session }: { session: NativeViewportSession }) {
  const [streamStatus, setStreamStatus] = useState<StreamStatus>("idle");
  const [videoMeta, setVideoMeta] = useState({ height: 1920, width: 1080 });
  const [capabilityOverride, setCapabilityOverride] = useState<null | { reason?: string; state?: string }>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const pointerGestureRef = useRef<null | (NativeCanvasPoint & { startedAt: number })>(null);
  const generationRef = useRef(0);
  const cleanupRef = useRef<null | (() => Promise<void>)>(null);
  const pendingBootstrapRef = useRef<null | {
    key: string;
    promise: Promise<import("@/lib/p2p/worker-control").NativeRemoteV2StreamDescriptor>;
  }>(null);
  const effectiveCapability = capabilityOverride ?? session.nativeRemoteV2.capability;
  const capabilityState = effectiveCapability.state?.trim().toLowerCase() ?? "";
  const currentNode = session.getCurrentNode();
  const currentNodeKey = getBrowserNodeInstanceKey(currentNode);
  const capabilityMeta = getAndroidNativeRemoteV2AvailabilityMeta(
    effectiveCapability.state,
    effectiveCapability.reason,
  );

  const directExperiment = buildDirectExperimentViewModel({
    candidatePairSummary: session.candidatePairSummary,
    directEvidenceSummary: session.directEvidenceSummary,
    lastError: session.lastError,
    lastResult: session.lastResult,
    runDirectExperiment: session.runDirectExperiment,
    state: session.state,
  });

  const sessionInfoItems = [
    { label: "Peer ID", value: session.peerId },
    { label: "模式", value: "原生" },
    { label: "状态", value: streamStatus },
    { label: "画面尺寸", value: `${videoMeta.width} x ${videoMeta.height}` },
  ];

  const unavailableHint = createNativeV2UnavailableHint(capabilityMeta.detail);

  const remoteStatus = buildNativeV2RemoteStatus({
    capabilityDetail: capabilityMeta.detail,
    capabilityState,
    streamStatus,
  });

  const actionController = createNativeV2ActionController({
    getSession: () => session,
    getStreamStatus: () => streamStatus,
    onActionError: (_message, error) => {
      console.error("native v2 action error", error);
      setStreamStatus("error");
    },
  });

  const pointerHandlers = createNativeV2PointerHandlers({
    canvasRef,
    getStreamStatus: () => streamStatus,
    getVideoMeta: () => videoMeta,
    gestureRef: pointerGestureRef,
    onActionError: (_message, error) => {
      console.error("native v2 pointer error", error);
      setStreamStatus("error");
    },
    session,
  });

  const lifecycleController = createNativeV2LifecycleController({
    canvasRef,
    cleanupRef,
    currentNode,
    currentNodeKey,
    generationRef,
    getCapabilityState: () => capabilityState,
    pendingBootstrapRef,
    session,
    setCapabilityOverride,
    setStreamStatus,
    setVideoMeta,
  });

  useEffect(() => {
    setCapabilityOverride(null);
  }, [currentNodeKey, session.peerId, session.targetAddress]);

  useEffect(() => {
    const nextCapabilityState = session.nativeRemoteV2.capability.state?.trim().toLowerCase() ?? "";
    if (nextCapabilityState === "available" || nextCapabilityState === "streaming") {
      setCapabilityOverride(null);
    }
  }, [session.nativeRemoteV2.capability.state]);

  useEffect(() => {
    void lifecycleController.startNativeStream();
    return () => {
      generationRef.current += 1;
      void lifecycleController.closeActiveStream();
    };
  }, [capabilityState, currentNodeKey, session.peerId, session.targetAddress]);

  async function invokeKey(key: string) {
    await actionController.invokeKey(key);
  }

  async function sendText(text: string) {
    return await actionController.sendText(text);
  }

  async function captureScreenshot() {
    await actionController.captureScreenshot();
  }

  function handleCanvasPointerDown(event: ReactPointerEvent<HTMLCanvasElement>) {
    pointerHandlers.handlePointerDown(event);
  }

  async function handleCanvasPointerUp(event: ReactPointerEvent<HTMLCanvasElement>) {
    await pointerHandlers.handlePointerUp(event);
  }

  const statusOverlay = (
    <AndroidNativeV2StatusOverlay
      capabilityDetail={capabilityMeta.detail}
      capabilityLabel={capabilityMeta.label}
      remoteStatus={remoteStatus}
    />
  );

  return (
    <div className="flex h-full min-h-0 items-center justify-center bg-black">
      <div className="flex h-full w-full min-h-0 items-center justify-center overflow-auto p-0">
        <div className="flex w-full min-w-0 flex-col items-center justify-center gap-0 md:flex-row md:items-stretch md:justify-center md:gap-0">
          <section
            data-testid="android-native-v2-stage"
            className="flex min-h-0 min-w-0 flex-1 justify-center md:justify-end"
          >
            <div className="flex w-full max-w-[420px] flex-col bg-black">
              <div
                className="relative w-full overflow-hidden bg-black"
                style={{ aspectRatio: `${videoMeta.width}/${videoMeta.height}` }}
              >
                <div className="relative flex h-full w-full items-center justify-center overflow-hidden bg-black">
                  <canvas
                    data-testid="android-remote-canvas"
                    ref={canvasRef}
                    onPointerDown={handleCanvasPointerDown}
                    onPointerCancel={() => {
                      pointerHandlers.handlePointerCancel();
                    }}
                    onPointerUp={(event) => {
                      void handleCanvasPointerUp(event);
                    }}
                    className="max-h-full max-w-full touch-none select-none bg-[radial-gradient(circle_at_top,_rgba(59,130,246,0.18),_rgba(15,23,42,0.96)_58%)]"
                  />
                  {statusOverlay}
                </div>
              </div>
              <AndroidDeviceNavigationBar
                controlsEnabled={streamStatus === "connected"}
                onBack={() => void invokeKey("back")}
                onHome={() => void invokeKey("home")}
                onRecents={() => void invokeKey("recents")}
              />
            </div>
          </section>

          <AndroidControlRail
            directExperiment={directExperiment}
            onReconnect={() => {
              void lifecycleController.startNativeStream({ forceRetry: true });
            }}
            reconnectEnabled={streamStatus !== "connecting"}
            onRotate={() => undefined}
            onScreenshot={() => {
              void captureScreenshot();
            }}
            onSendText={sendText}
            remoteStatus={remoteStatus}
            rotateEnabled={false}
            rotateHint={{ ...unavailableHint, op: "rotate" }}
            screenshotEnabled={streamStatus === "connected"}
            screenshotHint={{ ...unavailableHint, op: "captureScreenshot" }}
            sessionInfoItems={sessionInfoItems}
            showPerformanceControls={false}
            textActionsEnabled={streamStatus === "connected"}
            textInputHint={{ ...unavailableHint, op: "writeClipboard" }}
          />
        </div>
      </div>
    </div>
  );
}
