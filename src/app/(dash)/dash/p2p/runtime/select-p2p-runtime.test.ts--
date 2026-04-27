// @vitest-environment jsdom

import { describe, expect, it } from "vitest";
import { selectP2PShellKind } from "./select-p2p-runtime";

describe("selectP2PShellKind", () => {
  it("selects server-shell when no gomtm host bridge exists", () => {
    expect(selectP2PShellKind(window)).toBe("server-shell");
  });

  it("selects device-shell when a gomtm host bridge exists", () => {
    const win = window as Window & {
      GomtmHostBridge?: {
        getHostInfo?: () => unknown;
      };
    };
    win.GomtmHostBridge = {
      getHostInfo: () => null,
    };

    expect(selectP2PShellKind(window)).toBe("device-shell");

    delete win.GomtmHostBridge;
  });
});
