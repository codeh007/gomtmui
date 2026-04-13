"use client";

import { type PointerEvent as ReactPointerEvent, useEffect, useRef, useState } from "react";
import {
  ensureNativeRemoteV2Stream,
  invokeNativeRemoteV2Key,
  invokeNativeRemoteV2Tap,
  type NativeRemoteV2StreamDescriptor,
  openNativeRemoteV2VideoStream,
  type WorkerControlRequestError,
} from "@/lib/p2p/worker-control";
import { AndroidNativeV2StatusOverlay } from "./android-native-v2-status-overlay";
import { getAndroidNativeRemoteV2AvailabilityMeta } from "./android-session-model";
import { createNativeAndroidCanvasRenderer } from "./native-android-video-renderer";
import {
  buildNativeV2DirectExperiment,
  buildNativeV2RemoteStatus,
  buildNativeV2SessionDebugItems,
  buildNativeV2SessionInfoItems,
  createNativeV2UnavailableHint,
} from "./p2p-android-native-v2-view-model";
import type { NativeViewportSessionLike, StreamStatus } from "./p2p-android-native-v2-webrtc-panel-shared";
import { AndroidControlRail, AndroidDeviceNavigationBar } from "./p2p-android-viewport-control-rail";

type NativeViewportSession = NativeViewportSessionLike;

function isScreenCapturePermissionError(error: unknown): error is WorkerControlRequestError {
  if (error instanceof Error && "code" in error) {
    const code =
      typeof (error as { code?: unknown }).code === "string" ? (error as { code?: string }).code?.trim() : "";
    if (code === "SB_PERMISSION_REQUIRED") {
      return true;
    }
  }
  const message = error instanceof Error ? error.message.trim().toLowerCase() : String(error).trim().toLowerCase();
  return message.includes("screen capture permission is not granted");
}

export function P2PAndroidNativeV2WebRtcPanel({ session }: { session: NativeViewportSession }) {
  const [streamStatus, setStreamStatus] = useState<StreamStatus>("idle");
  const [streamError, setStreamError] = useState<string | null>(null);
  const [videoMeta, setVideoMeta] = useState({ height: 1920, width: 1080 });
  const [capabilityOverride, setCapabilityOverride] = useState<null | { reason?: string; state?: string }>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const generationRef = useRef(0);
  const cleanupRef = useRef<null | (() => Promise<void>)>(null);
  const pendingBootstrapRef = useRef<null | {
    key: string;
    promise: Promise<NativeRemoteV2StreamDescriptor>;
  }>(null);
  const effectiveCapability = capabilityOverride ?? session.nativeRemoteV2.capability;
  const capabilityState = effectiveCapability.state?.trim().toLowerCase() ?? "";
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
    capabilityLabel: capabilityMeta.label,
    capabilityState,
    streamStatus,
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
    peerId: string;
  }) {
    const key = `${params.peerId}::${params.address}`;
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

    const node = session.getCurrentNode();
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
  }, [session.peerId, session.targetAddress]);

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
  }, [capabilityState, session.peerId, session.targetAddress]);

  async function invokeKey(key: string) {
    const node = session.getCurrentNode();
    const address = session.targetAddress;
    if (node == null || address == null || streamStatus !== "connected") {
      return;
    }
    try {
      await invokeNativeRemoteV2Key({ address, key, node, peerId: session.peerId });
    } catch (error) {
      console.error("native v2 key error", error);
      setStreamStatus("error");
      setStreamError("操作失败");
    }
  }

  async function handleCanvasClick(event: ReactPointerEvent<HTMLCanvasElement>) {
    const node = session.getCurrentNode();
    const address = session.targetAddress;
    const canvas = canvasRef.current;
    if (node == null || address == null || canvas == null || streamStatus !== "connected") {
      return;
    }

    const rect = canvas.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) {
      return;
    }

    const x = Math.round(((event.clientX - rect.left) / rect.width) * videoMeta.width);
    const y = Math.round(((event.clientY - rect.top) / rect.height) * videoMeta.height);
    try {
      await invokeNativeRemoteV2Tap({ address, node, peerId: session.peerId, x, y });
    } catch (error) {
      console.error("native v2 tap error", error);
      setStreamStatus("error");
      setStreamError("操作失败");
    }
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
                    onPointerUp={(event) => {
                      void handleCanvasClick(event);
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
            onPerformanceProfileChange={() => undefined}
            onReconnect={() => {
              void startNativeStream({ forceRetry: true });
            }}
            reconnectEnabled={streamStatus !== "connecting"}
            onRotate={() => undefined}
            onScreenshot={() => undefined}
            onSendText={async () => false}
            performanceMeta="原生"
            performanceProfile="medium"
            remoteStatus={remoteStatus}
            rotateEnabled={false}
            rotateHint={{ ...unavailableHint, op: "rotate" }}
            screenshotEnabled={false}
            screenshotHint={{ ...unavailableHint, op: "captureScreenshot" }}
            sessionDebugItems={sessionDebugItems}
            sessionInfoItems={sessionInfoItems}
            textActionsEnabled={false}
            textInputHint={{ ...unavailableHint, op: "writeClipboard" }}
          />
        </div>
      </div>
    </div>
  );
}
