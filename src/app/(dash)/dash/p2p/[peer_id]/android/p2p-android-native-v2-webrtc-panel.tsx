"use client";

import { type PointerEvent as ReactPointerEvent, useEffect, useRef, useState } from "react";
import {
  ensureNativeRemoteV2Stream,
  type NativeRemoteV2StreamDescriptor,
  openNativeRemoteV2VideoStream,
} from "@/lib/p2p/worker-control";
import { AndroidNativeV2StatusOverlay } from "./android-native-v2-status-overlay";
import { getAndroidNativeRemoteV2AvailabilityMeta } from "./android-session-model";
import { createNativeAndroidCanvasRenderer } from "./native-android-video-renderer";
import { getBrowserNodeInstanceKey, isScreenCapturePermissionError, type NativeCanvasPoint } from "./p2p-android-native-v2-webrtc-panel-utils";
import { createNativeV2ActionController, createNativeV2PointerHandlers } from "./p2p-android-native-v2-panel-actions";
import {
  buildNativeV2DirectExperiment,
  buildNativeV2RemoteStatus,
  buildNativeV2SessionDebugItems,
  buildNativeV2SessionInfoItems,
  createNativeV2UnavailableHint,
} from "./p2p-android-native-v2-view-model";
import type { NativeViewportSessionLike, StreamStatus } from "./p2p-android-native-v2-webrtc-panel-shared";
import { AndroidDeviceNavigationBar } from "./android-device-navigation-bar";
import { AndroidControlRail } from "./p2p-android-viewport-control-rail";

type NativeViewportSession = NativeViewportSessionLike;

export function P2PAndroidNativeV2WebRtcPanel({ session }: { session: NativeViewportSession }) {
  const [streamStatus, setStreamStatus] = useState<StreamStatus>("idle");
  const [streamError, setStreamError] = useState<string | null>(null);
  const [videoMeta, setVideoMeta] = useState({ height: 1920, width: 1080 });
  const [capabilityOverride, setCapabilityOverride] = useState<null | { reason?: string; state?: string }>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const pointerGestureRef = useRef<null | (NativeCanvasPoint & { startedAt: number })>(null);
  const generationRef = useRef(0);
  const cleanupRef = useRef<null | (() => Promise<void>)>(null);
  const pendingBootstrapRef = useRef<null | {
    key: string;
    promise: Promise<NativeRemoteV2StreamDescriptor>;
  }>(null);
  const effectiveCapability = capabilityOverride ?? session.nativeRemoteV2.capability;
  const capabilityState = effectiveCapability.state?.trim().toLowerCase() ?? "";
  const currentNode = session.getCurrentNode();
  const currentNodeKey = getBrowserNodeInstanceKey(currentNode);
  const capabilityMeta = getAndroidNativeRemoteV2AvailabilityMeta(
    effectiveCapability.state,
    effectiveCapability.reason,
  );

  const directExperiment = buildNativeV2DirectExperiment(session);

  const sessionInfoItems = buildNativeV2SessionInfoItems({
    peerId: session.peerId,
    streamStatus,
    videoHeight: videoMeta.height,
    videoWidth: videoMeta.width,
  });

  const sessionDebugItems = buildNativeV2SessionDebugItems({
    lastError: streamError,
    session,
  });

  const remoteStatus = buildNativeV2RemoteStatus({
    capabilityDetail: capabilityMeta.detail,
    capabilityState,
    streamStatus,
  });

  const actionController = createNativeV2ActionController({
    getSession: () => session,
    getStreamStatus: () => streamStatus,
    onActionError: (message, error) => {
      console.error("native v2 action error", error);
      setStreamStatus("error");
      setStreamError(message);
    },
  });

  const pointerHandlers = createNativeV2PointerHandlers({
    canvasRef,
    getStreamStatus: () => streamStatus,
    getVideoMeta: () => videoMeta,
    gestureRef: pointerGestureRef,
    onActionError: (message, error) => {
      console.error("native v2 pointer error", error);
      setStreamStatus("error");
      setStreamError(message);
    },
    session,
  });

  async function closeActiveStream() {
    const cleanup = cleanupRef.current;
    cleanupRef.current = null;
    await cleanup?.().catch(() => undefined);
  }

  async function ensureDescriptorSingleFlight(params: {
    address: string;
    forceRefresh?: boolean;
    node: NonNullable<ReturnType<NativeViewportSession["getCurrentNode"]>>;
    nodeKey: string;
    peerId: string;
  }) {
    const key = `${params.peerId}::${params.address}::${params.nodeKey}`;
    if (params.forceRefresh) {
      pendingBootstrapRef.current = null;
    }

    const existing = pendingBootstrapRef.current;
    if (existing != null && existing.key === key) {
      return await existing.promise;
    }

    const promise = (async () => {
      const descriptor = await ensureNativeRemoteV2Stream({
        address: params.address,
        node: params.node,
        peerId: params.peerId,
      });
      if (descriptor == null) {
        throw new Error("native remote descriptor missing");
      }
      return descriptor;
    })();
    pendingBootstrapRef.current = { key, promise };

    try {
      return await promise;
    } finally {
      if (pendingBootstrapRef.current?.promise === promise) {
        pendingBootstrapRef.current = null;
      }
    }
  }

  async function startNativeStream(options?: { forceRetry?: boolean }) {
    const generation = generationRef.current + 1;
    generationRef.current = generation;
    await closeActiveStream();
    setCapabilityOverride(null);

    if (!options?.forceRetry && (capabilityState === "permission_required" || capabilityState === "unavailable")) {
      setStreamStatus("idle");
      setStreamError(null);
      return;
    }

    const node = currentNode;
    const address = session.targetAddress;
    if (node == null || address == null) {
      setStreamStatus("error");
      setStreamError("当前不可用");
      return;
    }

    setStreamStatus("connecting");
    setStreamError(null);

    try {
      const descriptor = await ensureDescriptorSingleFlight({
        address,
        forceRefresh: options?.forceRetry === true,
        node,
        nodeKey: currentNodeKey,
        peerId: session.peerId,
      });
      if (generationRef.current !== generation) {
        return;
      }

      const videoStream = await openNativeRemoteV2VideoStream({
        address,
        descriptor,
        node,
        peerId: session.peerId,
      });
      if (generationRef.current !== generation) {
        await videoStream.close();
        return;
      }

      const canvas = canvasRef.current;
      if (canvas == null) {
        await videoStream.close();
        throw new Error("canvas not mounted");
      }

      const width = descriptor.channel?.width ?? 1080;
      const height = descriptor.channel?.height ?? 1920;
      canvas.width = width;
      canvas.height = height;
      setVideoMeta({ height, width });

      const renderer = createNativeAndroidCanvasRenderer({
        canvas,
        metadata: {
          codec: descriptor.channel?.codec,
          height,
          rotation: descriptor.channel?.rotation,
          width,
        },
        onError: (error) => {
          if (generationRef.current !== generation) {
            return;
          }
          console.error("native v2 render error", error);
          setStreamStatus("error");
          setStreamError("画面异常");
        },
      });

      cleanupRef.current = async () => {
        await renderer.close();
        await videoStream.close();
      };

      setStreamStatus("connected");

      for await (const packet of videoStream.packets) {
        if (generationRef.current !== generation) {
          break;
        }
        await renderer.renderPacket(packet);
      }

      if (generationRef.current === generation) {
        setStreamStatus("error");
        setStreamError("画面已结束");
      }
    } catch (error) {
      if (generationRef.current !== generation) {
        return;
      }
      if (isScreenCapturePermissionError(error)) {
        setCapabilityOverride({
          reason: "screen_capture_not_granted",
          state: "permission_required",
        });
        setStreamStatus("idle");
        setStreamError(null);
        return;
      }
      console.error("native v2 connect error", error);
      setStreamStatus("error");
      setStreamError("连接失败");
    }
  }

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
    void startNativeStream();
    return () => {
      generationRef.current += 1;
      void closeActiveStream();
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

  const unavailableHint = createNativeV2UnavailableHint("暂未开放");

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
              void startNativeStream({ forceRetry: true });
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
            sessionDebugItems={sessionDebugItems}
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
