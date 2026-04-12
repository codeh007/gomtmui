import type {
  ClipboardEvent as ReactClipboardEvent,
  CompositionEvent as ReactCompositionEvent,
  FormEvent as ReactFormEvent,
  KeyboardEvent as ReactKeyboardEvent,
  RefObject,
} from "react";
import type { AndroidDeviceOpError } from "@/lib/p2p/android-scrcpy-session";
import { canInjectTextDirectly } from "./p2p-android-viewport-gesture";
import type {
  AndroidDeviceOpNotice,
  AndroidKeyCodeValue,
  AndroidScrcpyControllerLike,
} from "./p2p-android-viewport-support";
import { DIRECT_ANDROID_KEY_MAP, ERROR_MESSAGE, MISSING_DEVICE_OPS_MESSAGE } from "./p2p-android-viewport-support";

type UseAndroidKeyboardBridgeParams = {
  controlsEnabled: boolean;
  handleDeviceOpError: (op: "writeClipboard", error: unknown) => void;
  inputRef: RefObject<HTMLTextAreaElement | null>;
  onSessionError: (message: string) => void;
  resolveController: () => AndroidScrcpyControllerLike | undefined;
  resolveDeviceOps: () => {
    writeClipboard: (text: string, options: { paste: boolean }) => Promise<void>;
  } | null;
  sendKeyCode: (keyCode: AndroidKeyCodeValue) => Promise<void>;
  setDeviceOpNotice: (notice: AndroidDeviceOpNotice | null) => void;
};

export function useAndroidKeyboardBridge({
  controlsEnabled,
  handleDeviceOpError,
  inputRef,
  onSessionError,
  resolveController,
  resolveDeviceOps,
  sendKeyCode,
  setDeviceOpNotice,
}: UseAndroidKeyboardBridgeParams) {
  function clearKeyboardBridgeValue(target?: HTMLTextAreaElement | null) {
    const input = target ?? inputRef.current;
    if (input != null && input.value !== "") {
      input.value = "";
    }
  }

  function focusKeyboardBridge() {
    if (!controlsEnabled) {
      return;
    }

    const input = inputRef.current;
    if (input == null) {
      return;
    }

    clearKeyboardBridgeValue(input);
    input.focus({ preventScroll: true });
  }

  async function sendTextToDevice(text: string) {
    if (text === "") {
      return false;
    }

    const controller = resolveController();
    if (canInjectTextDirectly(text) && controller != null) {
      try {
        setDeviceOpNotice(null);
        await controller.injectText(text);
        return true;
      } catch (error) {
        onSessionError(error instanceof Error ? error.message : ERROR_MESSAGE);
        return false;
      } finally {
        clearKeyboardBridgeValue();
      }
    }

    try {
      const deviceOps = resolveDeviceOps();
      if (deviceOps == null) {
        throw new Error(MISSING_DEVICE_OPS_MESSAGE);
      }

      setDeviceOpNotice(null);
      await deviceOps.writeClipboard(text, { paste: true });
      return true;
    } catch (error) {
      if (isDeviceOpError(error)) {
        handleDeviceOpError("writeClipboard", error);
        return false;
      }

      onSessionError(error instanceof Error ? error.message : ERROR_MESSAGE);
      return false;
    } finally {
      clearKeyboardBridgeValue();
    }
  }

  function handleKeyboardBridgeKeyDown(event: ReactKeyboardEvent<HTMLTextAreaElement>) {
    if (!controlsEnabled) {
      return;
    }

    const mappedKeyCode = DIRECT_ANDROID_KEY_MAP[event.key];
    if (mappedKeyCode != null) {
      event.preventDefault();
      clearKeyboardBridgeValue(event.currentTarget);
      void sendKeyCode(mappedKeyCode);
      return;
    }

    if ((event.nativeEvent as KeyboardEvent).isComposing) {
      return;
    }

    if (event.ctrlKey || event.metaKey || event.altKey) {
      return;
    }

    if (event.key.length !== 1 || !canInjectTextDirectly(event.key)) {
      return;
    }

    event.preventDefault();
    clearKeyboardBridgeValue(event.currentTarget);
    void sendTextToDevice(event.key);
  }

  function handleKeyboardBridgeBeforeInput(event: ReactFormEvent<HTMLTextAreaElement>) {
    if (!controlsEnabled) {
      return;
    }

    const nativeEvent = event.nativeEvent as InputEvent;
    const text = nativeEvent.data ?? "";
    if (text === "" || nativeEvent.isComposing || canInjectTextDirectly(text)) {
      return;
    }

    event.preventDefault();
    clearKeyboardBridgeValue(event.currentTarget);
    void sendTextToDevice(text);
  }

  function handleKeyboardBridgeCompositionEnd(event: ReactCompositionEvent<HTMLTextAreaElement>) {
    if (!controlsEnabled) {
      return;
    }

    const text = event.data || event.currentTarget.value;
    clearKeyboardBridgeValue(event.currentTarget);
    if (text === "") {
      return;
    }

    void sendTextToDevice(text);
  }

  function handleKeyboardBridgePaste(event: ReactClipboardEvent<HTMLTextAreaElement>) {
    if (!controlsEnabled) {
      return;
    }

    const text = event.clipboardData.getData("text");
    if (text === "") {
      return;
    }

    event.preventDefault();
    clearKeyboardBridgeValue(event.currentTarget);
    void sendTextToDevice(text);
  }

  return {
    clearKeyboardBridgeValue,
    focusKeyboardBridge,
    handleKeyboardBridgeBeforeInput,
    handleKeyboardBridgeCompositionEnd,
    handleKeyboardBridgeKeyDown,
    handleKeyboardBridgePaste,
    sendTextToDevice,
  };
}

function isDeviceOpError(error: unknown): error is AndroidDeviceOpError {
  return typeof error === "object" && error != null && "code" in error && "message" in error;
}
