import type { Dispatch, SetStateAction } from "react";
import { AndroidDeviceOpError, type AndroidDeviceOpState } from "@/lib/p2p/android-scrcpy-session";
import type {
  AndroidDeviceOpNotice,
  AndroidKeyCodeValue,
  AndroidScrcpyControllerLike,
} from "./p2p-android-viewport-support";
import {
  ANDROID_KEY_ACTION_DOWN,
  ANDROID_KEY_ACTION_UP,
  ANDROID_KEY_META_NONE,
  ERROR_MESSAGE,
} from "./p2p-android-viewport-support";

type AndroidDeviceOpsLike = {
  captureScreenshot: () => Promise<{ blob: Blob; height: number; width: number }>;
  rotate: () => Promise<void>;
};

type UseAndroidDeviceActionsParams = {
  handleDeviceOpError: (op: "captureScreenshot" | "rotate", error: unknown) => void;
  onSessionError: (message: string) => void;
  resolveController: () => AndroidScrcpyControllerLike | undefined;
  resolveDeviceOps: () => AndroidDeviceOpsLike | null;
  rotateEnabled: boolean;
  rotateState: AndroidDeviceOpState;
  screenshotEnabled: boolean;
  screenshotState: AndroidDeviceOpState;
  setDeviceOpNotice: Dispatch<SetStateAction<AndroidDeviceOpNotice | null>>;
  setDeviceOpOverrides: Dispatch<
    SetStateAction<Partial<Record<"captureScreenshot" | "rotate" | "writeClipboard", AndroidDeviceOpState>>>
  >;
  setDeviceOpStatusNotice: (op: "captureScreenshot" | "rotate", state: AndroidDeviceOpState) => void;
};

export function useAndroidDeviceActions({
  handleDeviceOpError,
  onSessionError,
  resolveController,
  resolveDeviceOps,
  rotateEnabled,
  rotateState,
  screenshotEnabled,
  screenshotState,
  setDeviceOpNotice,
  setDeviceOpOverrides,
  setDeviceOpStatusNotice,
}: UseAndroidDeviceActionsParams) {
  async function sendKeyCode(keyCode: AndroidKeyCodeValue) {
    const controller = resolveController();
    if (controller == null) {
      return;
    }

    try {
      await controller.injectKeyCode({
        action: ANDROID_KEY_ACTION_DOWN,
        keyCode,
        metaState: ANDROID_KEY_META_NONE,
        repeat: 0,
      });
      await controller.injectKeyCode({
        action: ANDROID_KEY_ACTION_UP,
        keyCode,
        metaState: ANDROID_KEY_META_NONE,
        repeat: 0,
      });
    } catch (error) {
      onSessionError(error instanceof Error ? error.message : ERROR_MESSAGE);
    }
  }

  async function rotateDevice() {
    const deviceOps = resolveDeviceOps();
    if (!rotateEnabled || deviceOps == null) {
      setDeviceOpStatusNotice("rotate", rotateState);
      return;
    }

    setDeviceOpNotice(null);
    try {
      await deviceOps.rotate();
      setDeviceOpOverrides((current) => {
        if (current.rotate == null) {
          return current;
        }
        return {
          ...current,
          rotate: undefined,
        };
      });
    } catch (error) {
      handleDeviceOpError("rotate", error);
    }
  }

  async function captureScreenshot() {
    const deviceOps = resolveDeviceOps();
    if (!screenshotEnabled || deviceOps == null) {
      setDeviceOpStatusNotice("captureScreenshot", screenshotState);
      return;
    }
    if (typeof document === "undefined") {
      handleDeviceOpError(
        "captureScreenshot",
        new AndroidDeviceOpError("captureScreenshot", "unsupported", "当前环境不支持下载截图。"),
      );
      return;
    }

    setDeviceOpNotice(null);
    try {
      const screenshot = await deviceOps.captureScreenshot();
      const url = URL.createObjectURL(screenshot.blob);
      const downloadLink = document.createElement("a");
      downloadLink.href = url;
      downloadLink.download = `gomtm-android-${Date.now()}.png`;
      downloadLink.click();
      window.setTimeout(() => {
        URL.revokeObjectURL(url);
      }, 0);
      setDeviceOpNotice({
        detail: `已导出 ${screenshot.width}x${screenshot.height} PNG 截图。`,
        title: "截图已下载",
        tone: "success",
      });
    } catch (error) {
      handleDeviceOpError("captureScreenshot", error);
    }
  }

  return {
    captureScreenshot,
    rotateDevice,
    sendKeyCode,
  };
}
