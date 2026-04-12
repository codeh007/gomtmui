import { expect, it, vi } from "vitest";

import { closeReadableControllerSafely, isIgnorableWritableStreamSendError } from "./adb-transport";

it("ignores readable stream close races after the stream has already errored", () => {
  const controller = {
    close: vi.fn(() => {
      throw new TypeError("Cannot close an errored readable stream");
    }),
  };

  expect(() => closeReadableControllerSafely(controller)).not.toThrow();
  expect(controller.close).toHaveBeenCalledTimes(1);
});

it("rethrows unexpected controller close errors", () => {
  const controller = {
    close: vi.fn(() => {
      throw new Error("unexpected controller failure");
    }),
  };

  expect(() => closeReadableControllerSafely(controller)).toThrow("unexpected controller failure");
  expect(controller.close).toHaveBeenCalledTimes(1);
});

it("treats closing writable stream send errors as ignorable", () => {
  expect(isIgnorableWritableStreamSendError(new Error("Cannot write to a stream that is closing"))).toBe(true);
  expect(isIgnorableWritableStreamSendError(new Error("cannot write to a stream that is closed"))).toBe(true);
});

it("does not hide unrelated writable stream send errors", () => {
  expect(isIgnorableWritableStreamSendError(new Error("unexpected controller failure"))).toBe(false);
});
