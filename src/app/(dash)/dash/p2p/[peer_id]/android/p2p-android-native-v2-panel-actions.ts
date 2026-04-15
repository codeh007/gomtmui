import {
  captureNativeRemoteV2Screenshot,
  invokeNativeRemoteV2Key,
  invokeNativeRemoteV2Swipe,
  invokeNativeRemoteV2Tap,
  invokeNativeRemoteV2Text,
} from "@/lib/p2p/worker-control";
import type { NativeViewportSessionLike, StreamStatus } from "./p2p-android-native-v2-webrtc-panel-shared";
import {
  projectCanvasPoint,
  triggerScreenshotDownload,
  type NativeCanvasPoint,
} from "./p2p-android-native-v2-webrtc-panel-utils";

type CanvasGesturePoint = NativeCanvasPoint & { startedAt: number };

type ActionContext = {
  getSession: () => NativeViewportSessionLike;
  getStreamStatus: () => StreamStatus;
  onActionError: (message: string, error: unknown) => void;
};

export function createNativeV2ActionController(context: ActionContext) {
  function getReadyTarget() {
    const session = context.getSession();
    const node = session.getCurrentNode();
    const address = session.targetAddress;
    if (node == null || address == null || context.getStreamStatus() !== "connected") {
      return null;
    }
    return {
      address,
      node,
      peerId: session.peerId,
      session,
    };
  }

  return {
    async captureScreenshot() {
      const target = getReadyTarget();
      if (target == null) {
        return;
      }

      try {
        const screenshot = await captureNativeRemoteV2Screenshot({
          address: target.address,
          format: "png",
          node: target.node,
          peerId: target.peerId,
        });
        const imageBase64 = screenshot.imageBase64?.trim();
        const mimeType = screenshot.mimeType?.trim() || "image/png";
        if (!imageBase64) {
          throw new Error("screen snapshot missing image payload");
        }
        triggerScreenshotDownload({ imageBase64, mimeType, peerId: target.peerId });
      } catch (error) {
        context.onActionError("截图失败", error);
      }
    },

    async invokeKey(key: string) {
      const target = getReadyTarget();
      if (target == null) {
        return;
      }

      try {
        await invokeNativeRemoteV2Key({
          address: target.address,
          key,
          node: target.node,
          peerId: target.peerId,
        });
      } catch (error) {
        context.onActionError("操作失败", error);
      }
    },

    async sendText(text: string) {
      const target = getReadyTarget();
      if (target == null) {
        return false;
      }

      const nextText = text.trim();
      if (nextText === "") {
        return false;
      }

      try {
        await invokeNativeRemoteV2Text({
          address: target.address,
          node: target.node,
          peerId: target.peerId,
          text: nextText,
        });
        return true;
      } catch (error) {
        context.onActionError("操作失败", error);
        return false;
      }
    },
  };
}

export function createNativeV2PointerHandlers(params: {
  canvasRef: { current: HTMLCanvasElement | null };
  getStreamStatus: () => StreamStatus;
  getVideoMeta: () => { height: number; width: number };
  gestureRef: { current: CanvasGesturePoint | null };
  onActionError: (message: string, error: unknown) => void;
  session: NativeViewportSessionLike;
}) {
  return {
    handlePointerCancel() {
      params.gestureRef.current = null;
    },

    handlePointerDown(event: { clientX: number; clientY: number; timeStamp: number }) {
      const canvas = params.canvasRef.current;
      if (canvas == null || params.getStreamStatus() !== "connected") {
        params.gestureRef.current = null;
        return;
      }

      const videoMeta = params.getVideoMeta();
      const point = projectCanvasPoint({
        canvas,
        clientX: event.clientX,
        clientY: event.clientY,
        videoHeight: videoMeta.height,
        videoWidth: videoMeta.width,
      });
      if (point == null) {
        params.gestureRef.current = null;
        return;
      }

      params.gestureRef.current = {
        ...point,
        startedAt: event.timeStamp,
      };
    },

    async handlePointerUp(event: { clientX: number; clientY: number; timeStamp: number }) {
      const node = params.session.getCurrentNode();
      const address = params.session.targetAddress;
      const canvas = params.canvasRef.current;
      const gestureStart = params.gestureRef.current;
      params.gestureRef.current = null;
      if (node == null || address == null || canvas == null || params.getStreamStatus() !== "connected") {
        return;
      }

      const videoMeta = params.getVideoMeta();
      const point = projectCanvasPoint({
        canvas,
        clientX: event.clientX,
        clientY: event.clientY,
        videoHeight: videoMeta.height,
        videoWidth: videoMeta.width,
      });
      if (point == null) {
        return;
      }

      try {
        if (gestureStart == null) {
          await invokeNativeRemoteV2Tap({ address, node, peerId: params.session.peerId, x: point.x, y: point.y });
          return;
        }

        const maxDelta = Math.max(Math.abs(point.x - gestureStart.x), Math.abs(point.y - gestureStart.y));
        if (maxDelta < 12) {
          await invokeNativeRemoteV2Tap({ address, node, peerId: params.session.peerId, x: point.x, y: point.y });
          return;
        }

        await invokeNativeRemoteV2Swipe({
          address,
          durationMs: Math.max(120, Math.round(event.timeStamp - gestureStart.startedAt)),
          endX: point.x,
          endY: point.y,
          node,
          peerId: params.session.peerId,
          startX: gestureStart.x,
          startY: gestureStart.y,
        });
      } catch (error) {
        params.onActionError("操作失败", error);
      }
    },
  };
}
