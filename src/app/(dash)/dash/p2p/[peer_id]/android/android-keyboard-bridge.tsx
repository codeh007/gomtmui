import type {
  ClipboardEvent as ReactClipboardEvent,
  CompositionEvent as ReactCompositionEvent,
  FormEvent as ReactFormEvent,
  KeyboardEvent as ReactKeyboardEvent,
  RefObject,
} from "react";

type AndroidKeyboardBridgeProps = {
  inputRef: RefObject<HTMLTextAreaElement | null>;
  onBeforeInput: (event: ReactFormEvent<HTMLTextAreaElement>) => void;
  onCompositionEnd: (event: ReactCompositionEvent<HTMLTextAreaElement>) => void;
  onKeyDown: (event: ReactKeyboardEvent<HTMLTextAreaElement>) => void;
  onPaste: (event: ReactClipboardEvent<HTMLTextAreaElement>) => void;
};

export function AndroidKeyboardBridge({
  inputRef,
  onBeforeInput,
  onCompositionEnd,
  onKeyDown,
  onPaste,
}: AndroidKeyboardBridgeProps) {
  return (
    <textarea
      ref={inputRef}
      aria-label="Android 键盘桥接输入"
      autoCapitalize="off"
      autoCorrect="off"
      className="pointer-events-none absolute left-0 top-0 h-px w-px opacity-0"
      data-testid="android-keyboard-input"
      onBeforeInput={onBeforeInput}
      onCompositionEnd={onCompositionEnd}
      onKeyDown={onKeyDown}
      onPaste={onPaste}
      spellCheck={false}
      tabIndex={-1}
    />
  );
}
