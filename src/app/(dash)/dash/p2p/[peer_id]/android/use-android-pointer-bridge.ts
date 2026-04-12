import type { AndroidMotionEventAction } from "@yume-chan/scrcpy";
import type { PointerEvent as ReactPointerEvent, WheelEvent as ReactWheelEvent, RefObject } from "react";
import {
  ANDROID_MOTION_ACTION_DOWN,
  ANDROID_MOTION_ACTION_MOVE,
  ANDROID_MOTION_ACTION_UP,
  ANDROID_MOTION_BUTTON_NONE,
  ANDROID_MOTION_BUTTON_PRIMARY,
  ANDROID_WHEEL_SWIPE_POINTER_ID,
  clampPointerCoordinate,
  getActionButton,
  getButtonsMask,
  getTouchPressure,
  getViewportPoint,
  getWheelSwipeDistance,
  isTerminalTouchAction,
  normalizeScrollDelta,
  normalizeWheelPixels,
  type ScrcpyPointerPoint,
  type ScrcpyTouchPayload,
  shouldDispatchPointerMove,
} from "./p2p-android-viewport-gesture";
import type { AndroidScrcpyControllerLike, ViewportSize } from "./p2p-android-viewport-support";

type TouchDispatchState = {
  generation: number;
  inFlight: boolean;
  pending: ScrcpyTouchPayload | null;
};

type UseAndroidPointerBridgeParams = {
  canvasRef: RefObject<HTMLCanvasElement | null>;
  controlsEnabled: boolean;
  focusKeyboardBridge: () => void;
  onReconnectRequired: () => void;
  onSessionError: (message: string) => void;
  resolveController: () => AndroidScrcpyControllerLike | null;
  resetTouchDispatchState: () => void;
  setActivePointerId: (pointerId: number | null) => void;
  shouldReconnectOnControlError: (error: unknown) => boolean;
  touchDispatchStateRef: RefObject<TouchDispatchState>;
  viewportSize: ViewportSize;
};

export function useAndroidPointerBridge({
  canvasRef,
  controlsEnabled,
  focusKeyboardBridge,
  onReconnectRequired,
  onSessionError,
  resolveController,
  resetTouchDispatchState,
  setActivePointerId,
  shouldReconnectOnControlError,
  touchDispatchStateRef,
  viewportSize,
}: UseAndroidPointerBridgeParams) {
  function buildWheelSwipePayloads(point: ScrcpyPointerPoint, event: ReactWheelEvent<HTMLCanvasElement>) {
    const pixelDeltaX = normalizeWheelPixels(event.deltaX, event.deltaMode);
    const pixelDeltaY = normalizeWheelPixels(event.deltaY, event.deltaMode);
    const swipeDistanceX = getWheelSwipeDistance(pixelDeltaX, point.videoWidth);
    const swipeDistanceY = getWheelSwipeDistance(pixelDeltaY, point.videoHeight);
    if (swipeDistanceX === 0 && swipeDistanceY === 0) {
      return null;
    }

    const nextPointerX = clampPointerCoordinate(
      point.pointerX - Math.sign(pixelDeltaX) * swipeDistanceX,
      point.videoWidth,
    );
    const nextPointerY = clampPointerCoordinate(
      point.pointerY - Math.sign(pixelDeltaY) * swipeDistanceY,
      point.videoHeight,
    );
    if (nextPointerX === point.pointerX && nextPointerY === point.pointerY) {
      return null;
    }

    const sharedPoint = {
      pointerId: ANDROID_WHEEL_SWIPE_POINTER_ID,
      videoHeight: point.videoHeight,
      videoWidth: point.videoWidth,
    };

    return [
      {
        action: ANDROID_MOTION_ACTION_DOWN,
        actionButton: ANDROID_MOTION_BUTTON_PRIMARY,
        buttons: ANDROID_MOTION_BUTTON_PRIMARY,
        pointerX: point.pointerX,
        pointerY: point.pointerY,
        pressure: 1,
        ...sharedPoint,
      },
      {
        action: ANDROID_MOTION_ACTION_MOVE,
        actionButton: ANDROID_MOTION_BUTTON_PRIMARY,
        buttons: ANDROID_MOTION_BUTTON_PRIMARY,
        pointerX: nextPointerX,
        pointerY: nextPointerY,
        pressure: 1,
        ...sharedPoint,
      },
      {
        action: ANDROID_MOTION_ACTION_UP,
        actionButton: ANDROID_MOTION_BUTTON_PRIMARY,
        buttons: ANDROID_MOTION_BUTTON_NONE,
        pointerX: nextPointerX,
        pointerY: nextPointerY,
        pressure: 0,
        ...sharedPoint,
      },
    ] satisfies ScrcpyTouchPayload[];
  }

  async function injectWheelSwipeFallback(
    controller: AndroidScrcpyControllerLike,
    point: ScrcpyPointerPoint,
    event: ReactWheelEvent<HTMLCanvasElement>,
  ) {
    const payloads = buildWheelSwipePayloads(point, event);
    if (payloads == null) {
      return;
    }

    for (const payload of payloads) {
      await controller.injectTouch(payload);
    }
  }

  function buildTouchPayload(action: AndroidMotionEventAction, event: ReactPointerEvent<HTMLCanvasElement>) {
    const point = getViewportPoint(canvasRef.current, viewportSize, event.clientX, event.clientY);
    if (point == null) {
      return null;
    }

    return {
      action,
      actionButton: getActionButton(event.button),
      buttons: getButtonsMask(isTerminalTouchAction(action) ? 0 : event.buttons),
      pointerId: BigInt(event.pointerId),
      pressure: getTouchPressure(action, event.pressure),
      ...point,
    } satisfies ScrcpyTouchPayload;
  }

  function enqueuePendingTouchPayload(payload: ScrcpyTouchPayload) {
    const state = touchDispatchStateRef.current;
    if (state == null) {
      return;
    }
    if (state.pending == null) {
      state.pending = payload;
      return;
    }

    if (isTerminalTouchAction(payload.action)) {
      state.pending = payload;
      return;
    }

    if (payload.action === ANDROID_MOTION_ACTION_MOVE) {
      if (!isTerminalTouchAction(state.pending.action)) {
        state.pending = payload;
      }
      return;
    }

    state.pending = payload;
  }

  function injectTouchEvent(action: AndroidMotionEventAction, event: ReactPointerEvent<HTMLCanvasElement>) {
    const controller = resolveController();
    if (controller == null) {
      return;
    }

    const payload = buildTouchPayload(action, event);
    if (payload == null) {
      return;
    }

    const state = touchDispatchStateRef.current;
    if (state == null) {
      return;
    }
    if (state.inFlight) {
      enqueuePendingTouchPayload(payload);
      return;
    }

    state.inFlight = true;
    const generation = state.generation;

    void (async () => {
      let nextPayload: ScrcpyTouchPayload | null = payload;

      while (nextPayload != null) {
        try {
          await controller.injectTouch(nextPayload);
        } catch (error) {
          if (touchDispatchStateRef.current?.generation === generation) {
            resetTouchDispatchState();
            if (shouldReconnectOnControlError(error)) {
              setActivePointerId(null);
              onReconnectRequired();
              return;
            }
            onSessionError(error instanceof Error ? error.message : "当前无法建立 Android scrcpy 会话。");
          }
          return;
        }

        const activeState = touchDispatchStateRef.current;
        if (activeState == null || activeState.generation !== generation) {
          return;
        }

        nextPayload = activeState.pending;
        activeState.pending = null;
      }

      if (touchDispatchStateRef.current?.generation === generation) {
        touchDispatchStateRef.current.inFlight = false;
      }
    })();
  }

  function handlePointerDown(event: ReactPointerEvent<HTMLCanvasElement>) {
    if (!controlsEnabled) {
      return;
    }

    event.preventDefault();
    event.stopPropagation();
    focusKeyboardBridge();
    setActivePointerId(event.pointerId);
    canvasRef.current?.setPointerCapture?.(event.pointerId);
    injectTouchEvent(ANDROID_MOTION_ACTION_DOWN, event);
  }

  function handlePointerMove(event: ReactPointerEvent<HTMLCanvasElement>, activePointerId: number | null) {
    if (!controlsEnabled || activePointerId !== event.pointerId) {
      return;
    }

    if (!shouldDispatchPointerMove(event.buttons)) {
      return;
    }

    event.preventDefault();
    event.stopPropagation();
    injectTouchEvent(ANDROID_MOTION_ACTION_MOVE, event);
  }

  function handlePointerRelease(
    action: AndroidMotionEventAction,
    event: ReactPointerEvent<HTMLCanvasElement>,
    activePointerId: number | null,
  ) {
    if (!controlsEnabled || activePointerId !== event.pointerId) {
      return;
    }

    event.preventDefault();
    event.stopPropagation();
    setActivePointerId(null);
    canvasRef.current?.releasePointerCapture?.(event.pointerId);
    injectTouchEvent(action, event);
  }

  function handleViewportWheel(event: ReactWheelEvent<HTMLCanvasElement>) {
    if (!controlsEnabled) {
      return;
    }

    const controller = resolveController();
    if (controller == null) {
      return;
    }

    const point = getViewportPoint(canvasRef.current, viewportSize, event.clientX, event.clientY);
    if (point == null) {
      return;
    }

    const scrollX = normalizeScrollDelta(event.deltaX);
    const scrollY = normalizeScrollDelta(event.deltaY);
    if (scrollX === 0 && scrollY === 0) {
      return;
    }

    if (event.cancelable) {
      event.preventDefault();
    }
    focusKeyboardBridge();

    if (event.altKey) {
      void injectWheelSwipeFallback(controller, point, event).catch((error) => {
        onSessionError(error instanceof Error ? error.message : "当前无法建立 Android scrcpy 会话。");
      });
      return;
    }

    void controller
      .injectScroll({
        buttons: getButtonsMask(event.buttons),
        scrollX,
        scrollY,
        ...point,
      })
      .catch((error) => {
        onSessionError(error instanceof Error ? error.message : "当前无法建立 Android scrcpy 会话。");
      });
  }

  return {
    handlePointerDown,
    handlePointerMove,
    handlePointerRelease,
    handleViewportWheel,
  };
}
