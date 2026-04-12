import { AndroidMotionEventAction, AndroidMotionEventButton } from "@yume-chan/scrcpy";
import type { ViewportSize } from "./p2p-android-viewport-support";

export type ScrcpyPointerPoint = {
  pointerX: number;
  pointerY: number;
  videoHeight: number;
  videoWidth: number;
};

export type ScrcpyTouchPayload = ScrcpyPointerPoint & {
  action: AndroidMotionEventAction;
  actionButton: AndroidMotionEventButton;
  buttons: AndroidMotionEventButton;
  pointerId: bigint;
  pressure: number;
};

export const ANDROID_MOTION_ACTION_DOWN = AndroidMotionEventAction.Down;
export const ANDROID_MOTION_ACTION_MOVE = AndroidMotionEventAction.Move;
export const ANDROID_MOTION_ACTION_UP = AndroidMotionEventAction.Up;
export const ANDROID_MOTION_ACTION_CANCEL = AndroidMotionEventAction.Cancel;
export const ANDROID_MOTION_BUTTON_NONE = AndroidMotionEventButton.None;
export const ANDROID_MOTION_BUTTON_PRIMARY = AndroidMotionEventButton.Primary;
export const ANDROID_WHEEL_SWIPE_POINTER_ID = 9_001n;

export function getViewportPoint(
  canvas: HTMLCanvasElement | null,
  viewportSize: ViewportSize,
  clientX: number,
  clientY: number,
): ScrcpyPointerPoint | null {
  if (canvas == null) {
    return null;
  }

  const rect = canvas.getBoundingClientRect();
  if (rect.width <= 0 || rect.height <= 0) {
    return null;
  }

  const boundedX = Math.min(Math.max(clientX - rect.left, 0), rect.width);
  const boundedY = Math.min(Math.max(clientY - rect.top, 0), rect.height);

  return {
    pointerX: Math.round((boundedX / rect.width) * viewportSize.width),
    pointerY: Math.round((boundedY / rect.height) * viewportSize.height),
    videoHeight: viewportSize.height,
    videoWidth: viewportSize.width,
  };
}

export function getActionButton(button: number) {
  if (!Number.isFinite(button) || button < 0) {
    return ANDROID_MOTION_BUTTON_NONE;
  }

  if (button === 2) {
    return AndroidMotionEventButton.Secondary;
  }

  if (button === 1) {
    return AndroidMotionEventButton.Tertiary;
  }

  if (button > 4) {
    return ANDROID_MOTION_BUTTON_NONE;
  }

  return ANDROID_MOTION_BUTTON_PRIMARY;
}

export function getButtonsMask(buttons: number) {
  let mask = ANDROID_MOTION_BUTTON_NONE;

  if ((buttons & 1) !== 0) {
    mask |= ANDROID_MOTION_BUTTON_PRIMARY;
  }

  if ((buttons & 2) !== 0) {
    mask |= AndroidMotionEventButton.Secondary;
  }

  if ((buttons & 4) !== 0) {
    mask |= AndroidMotionEventButton.Tertiary;
  }

  return mask as AndroidMotionEventButton;
}

export function getTouchPressure(action: AndroidMotionEventAction, pressure: number) {
  if (action === ANDROID_MOTION_ACTION_UP || action === ANDROID_MOTION_ACTION_CANCEL) {
    return 0;
  }

  if (pressure > 0) {
    return pressure;
  }

  return 1;
}

export function shouldDispatchPointerMove(buttons: number) {
  return Number.isFinite(buttons) && buttons !== 0;
}

export function normalizeScrollDelta(delta: number) {
  if (!Number.isFinite(delta) || delta === 0) {
    return 0;
  }

  const step = Math.max(1, Math.min(16, Math.round(Math.abs(delta) / 24)));
  return Math.sign(delta) * step;
}

export function normalizeWheelPixels(delta: number, deltaMode: number) {
  if (!Number.isFinite(delta) || delta === 0) {
    return 0;
  }

  if (deltaMode === 1) {
    return delta * 16;
  }

  if (deltaMode === 2) {
    return delta * 240;
  }

  return delta;
}

export function clampPointerCoordinate(value: number, max: number) {
  return Math.max(0, Math.min(max, Math.round(value)));
}

export function getWheelSwipeDistance(delta: number, viewportLength: number) {
  if (!Number.isFinite(delta) || delta === 0) {
    return 0;
  }

  const normalized = Math.abs(delta);
  const minDistance = 32;
  const maxDistance = Math.max(minDistance, Math.round(viewportLength * 0.18));
  return Math.max(minDistance, Math.min(maxDistance, Math.round(normalized * 0.6)));
}

export function canInjectTextDirectly(text: string) {
  return /^[\x20-\x7E]+$/.test(text);
}

export function isTerminalTouchAction(action: AndroidMotionEventAction) {
  return action === ANDROID_MOTION_ACTION_UP || action === ANDROID_MOTION_ACTION_CANCEL;
}
