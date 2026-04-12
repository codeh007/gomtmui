import type { PointerEvent as ReactPointerEvent, WheelEvent as ReactWheelEvent, RefObject } from "react";
import { AndroidKeyboardBridge } from "./android-keyboard-bridge";

type AndroidRemoteCanvasProps = {
  canvasRef: RefObject<HTMLCanvasElement | null>;
  keyboardInputRef: RefObject<HTMLTextAreaElement | null>;
  onBeforeInput: (event: React.FormEvent<HTMLTextAreaElement>) => void;
  onCompositionEnd: (event: React.CompositionEvent<HTMLTextAreaElement>) => void;
  onKeyDown: (event: React.KeyboardEvent<HTMLTextAreaElement>) => void;
  onPaste: (event: React.ClipboardEvent<HTMLTextAreaElement>) => void;
  onPointerCancel: (event: ReactPointerEvent<HTMLCanvasElement>) => void;
  onPointerDown: (event: ReactPointerEvent<HTMLCanvasElement>) => void;
  onPointerMove: (event: ReactPointerEvent<HTMLCanvasElement>) => void;
  onPointerUp: (event: ReactPointerEvent<HTMLCanvasElement>) => void;
  onWheel: (event: ReactWheelEvent<HTMLCanvasElement>) => void;
  shouldRenderCanvas: boolean;
  viewportHeight: number;
  viewportWidth: number;
};

export function AndroidRemoteCanvas({
  canvasRef,
  keyboardInputRef,
  onBeforeInput,
  onCompositionEnd,
  onKeyDown,
  onPaste,
  onPointerCancel,
  onPointerDown,
  onPointerMove,
  onPointerUp,
  onWheel,
  shouldRenderCanvas,
  viewportHeight,
  viewportWidth,
}: AndroidRemoteCanvasProps) {
  return (
    <>
      <AndroidKeyboardBridge
        inputRef={keyboardInputRef}
        onBeforeInput={onBeforeInput}
        onCompositionEnd={onCompositionEnd}
        onKeyDown={onKeyDown}
        onPaste={onPaste}
      />
      {shouldRenderCanvas ? (
        <canvas
          ref={canvasRef}
          data-testid="android-remote-canvas"
          className="max-h-full max-w-full touch-none select-none"
          onPointerCancel={onPointerCancel}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onWheel={onWheel}
          style={{ aspectRatio: `${viewportWidth}/${viewportHeight}` }}
        />
      ) : null}
    </>
  );
}
