import { describe, expect, it } from "vitest";

import { resolveScrcpyServerAssetURL } from "./android-scrcpy-asset";

describe("resolveScrcpyServerAssetURL", () => {
  it("uses same-origin API proxy instead of vendored public asset path", () => {
    expect(resolveScrcpyServerAssetURL()).toBe("/api/android/scrcpy-server?v=3.3.3");
  });
});
