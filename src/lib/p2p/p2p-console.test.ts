import { afterEach, describe, expect, it, vi } from "vitest";
import { isVerboseP2PConsoleEnabled, logP2PConsole, summarizePeerCandidates } from "./p2p-console";

const originalWindow = globalThis.window;

function withWindowStorage(value: string | null) {
  Object.defineProperty(globalThis, "window", {
    configurable: true,
    value: {
      localStorage: {
        getItem: vi.fn((key: string) => (key === "gomtm:p2p:verbose-console" ? value : null)),
      },
    },
  });
}

afterEach(() => {
  vi.restoreAllMocks();
  Object.defineProperty(globalThis, "window", {
    configurable: true,
    value: originalWindow,
  });
});

describe("isVerboseP2PConsoleEnabled", () => {
  it("defaults to false when the browser environment is unavailable", () => {
    Object.defineProperty(globalThis, "window", {
      configurable: true,
      value: undefined,
    });

    expect(isVerboseP2PConsoleEnabled()).toBe(false);
  });

  it("returns true only when the explicit verbose flag is enabled", () => {
    withWindowStorage("1");
    expect(isVerboseP2PConsoleEnabled()).toBe(true);

    withWindowStorage(null);
    expect(isVerboseP2PConsoleEnabled()).toBe(false);
  });
});

describe("logP2PConsole", () => {
  it("skips verbose-only logs unless the flag is enabled", () => {
    const debugSpy = vi.spyOn(console, "debug").mockImplementation(() => undefined);

    withWindowStorage(null);
    logP2PConsole("debug", "节点候选已更新", { count: 2 }, { verboseOnly: true });
    expect(debugSpy).not.toHaveBeenCalled();

    withWindowStorage("1");
    logP2PConsole("debug", "节点候选已更新", { count: 2 }, { verboseOnly: true });
    expect(debugSpy).toHaveBeenCalledWith("[P2P] 节点候选已更新", { count: 2 });
  });
});

describe("summarizePeerCandidates", () => {
  it("reduces peer candidate logs to peer ids and address counts", () => {
    expect(
      summarizePeerCandidates([
        {
          multiaddrs: ["/ip4/127.0.0.1/tcp/4101/p2p/12D3KooWPeerOne", "/dns4/example.com/tcp/4101/p2p/12D3KooWPeerOne"],
          peerId: "12D3KooWPeerOne",
        },
      ]),
    ).toEqual({
      count: 1,
      peers: [
        {
          multiaddrCount: 2,
          peerId: "12D3KooWPeerOne",
        },
      ],
    });
  });
});
