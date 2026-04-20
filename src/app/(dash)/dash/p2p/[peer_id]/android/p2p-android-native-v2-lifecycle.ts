import {
  ensureNativeRemoteV2Stream,
  type NativeRemoteV2StreamDescriptor,
  openNativeRemoteV2VideoStream,
} from "@/lib/p2p/worker-control";
import { createNativeAndroidCanvasRenderer } from "./native-android-video-renderer";
import { isScreenCapturePermissionError } from "./p2p-android-native-v2-webrtc-panel-utils";
import type { NativeViewportSessionLike } from "./p2p-android-native-v2-webrtc-panel-shared";

type CapabilityOverride = null | { reason?: string; state?: string };

type NativeV2LifecycleParams = {
  canvasRef: { current: HTMLCanvasElement | null };
  cleanupRef: { current: null | (() => Promise<void>) };
  currentNode: ReturnType<NativeViewportSessionLike["getCurrentNode"]>;
  currentNodeKey: string;
  generationRef: { current: number };
  getCapabilityState: () => string;
  pendingBootstrapRef: {
    current: null | {
      key: string;
      promise: Promise<NativeRemoteV2StreamDescriptor>;
    };
  };
  session: NativeViewportSessionLike;
  setCapabilityOverride: (value: CapabilityOverride) => void;
  setStreamStatus: (status: "idle" | "connecting" | "connected" | "error") => void;
  setVideoMeta: (value: { height: number; width: number }) => void;
};

async function closeActiveStream(cleanupRef: { current: null | (() => Promise<void>) }) {
  const cleanup = cleanupRef.current;
  cleanupRef.current = null;
  await cleanup?.().catch(() => undefined);
}

async function ensureDescriptorSingleFlight(params: {
  address: string;
  forceRefresh?: boolean;
  node: NonNullable<ReturnType<NativeViewportSessionLike["getCurrentNode"]>>;
  nodeKey: string;
  peerId: string;
  pendingBootstrapRef: NativeV2LifecycleParams["pendingBootstrapRef"];
}) {
  const key = `${params.peerId}::${params.address}::${params.nodeKey}`;
  if (params.forceRefresh) {
    params.pendingBootstrapRef.current = null;
  }

  const existing = params.pendingBootstrapRef.current;
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
  params.pendingBootstrapRef.current = { key, promise };

  try {
    return await promise;
  } finally {
    if (params.pendingBootstrapRef.current?.promise === promise) {
      params.pendingBootstrapRef.current = null;
    }
  }
}

export function createNativeV2LifecycleController(params: NativeV2LifecycleParams) {
  return {
    async closeActiveStream() {
      await closeActiveStream(params.cleanupRef);
    },

    async startNativeStream(options?: { forceRetry?: boolean }) {
      const generation = params.generationRef.current + 1;
      params.generationRef.current = generation;
      await closeActiveStream(params.cleanupRef);
      params.setCapabilityOverride(null);

      const capabilityState = params.getCapabilityState();
      if (!options?.forceRetry && (capabilityState === "permission_required" || capabilityState === "unavailable")) {
        params.setStreamStatus("idle");
        return;
      }

      const node = params.currentNode;
      const address = params.session.targetAddress;
      if (node == null || address == null) {
        params.setStreamStatus("error");
        return;
      }

      params.setStreamStatus("connecting");

      try {
        const descriptor = await ensureDescriptorSingleFlight({
          address,
          forceRefresh: options?.forceRetry === true,
          node,
          nodeKey: params.currentNodeKey,
          peerId: params.session.peerId,
          pendingBootstrapRef: params.pendingBootstrapRef,
        });
        if (params.generationRef.current !== generation) {
          return;
        }

        const videoStream = await openNativeRemoteV2VideoStream({
          address,
          descriptor,
          node,
          peerId: params.session.peerId,
        });
        if (params.generationRef.current !== generation) {
          await videoStream.close();
          return;
        }

        const canvas = params.canvasRef.current;
        if (canvas == null) {
          await videoStream.close();
          throw new Error("canvas not mounted");
        }

        const width = descriptor.channel?.width ?? 1080;
        const height = descriptor.channel?.height ?? 1920;
        canvas.width = width;
        canvas.height = height;
        params.setVideoMeta({ height, width });

        const renderer = createNativeAndroidCanvasRenderer({
          canvas,
          metadata: {
            codec: descriptor.channel?.codec,
            height,
            rotation: descriptor.channel?.rotation,
            width,
          },
          onError: (error) => {
            if (params.generationRef.current !== generation) {
              return;
            }
            console.error("native v2 render error", error);
            params.setStreamStatus("error");
          },
        });

        params.cleanupRef.current = async () => {
          await renderer.close();
          await videoStream.close();
        };

        params.setStreamStatus("connected");

        for await (const packet of videoStream.packets) {
          if (params.generationRef.current !== generation) {
            break;
          }
          await renderer.renderPacket(packet);
        }

        if (params.generationRef.current === generation) {
          params.setStreamStatus("error");
        }
      } catch (error) {
        if (params.generationRef.current !== generation) {
          return;
        }
        if (isScreenCapturePermissionError(error)) {
          params.setCapabilityOverride({
            reason: "screen_capture_not_granted",
            state: "permission_required",
          });
          params.setStreamStatus("idle");
          return;
        }
        console.error("native v2 connect error", error);
        params.setStreamStatus("error");
      }
    },
  };
}
