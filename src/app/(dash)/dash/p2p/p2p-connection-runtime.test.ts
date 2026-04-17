// @vitest-environment jsdom

import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  clearStoredConnectionRuntime,
  normalizeBrowserConnectionAddr,
  persistStoredServerUrl,
  readStoredServerUrl,
  resolveConnectionEntryTargetAddress,
} from "./p2p-connection-runtime";

describe("p2p-connection-runtime", () => {
  beforeEach(() => {
    window.localStorage.clear();
    vi.unstubAllEnvs();
  });

  it("keeps only the first certhash for webtransport connection addr", () => {
    expect(
      normalizeBrowserConnectionAddr(
        "/ip4/156.233.234.137/udp/4101/quic-v1/webtransport/certhash/uEiFirst/certhash/uEiSecond/p2p/12D3KooWBootstrap",
      ),
    ).toBe("/ip4/156.233.234.137/udp/4101/quic-v1/webtransport/certhash/uEiFirst/p2p/12D3KooWBootstrap");
  });

  it("accepts browser dialable webtransport connection multiaddr", () => {
    expect(
      resolveConnectionEntryTargetAddress("/dns4/p2p.example.com/udp/8443/quic-v1/webtransport/certhash/uEiTest/p2p/12D3KooWBootstrap"),
    ).toEqual({
      connectionAddr: "/dns4/p2p.example.com/udp/8443/quic-v1/webtransport/certhash/uEiTest/p2p/12D3KooWBootstrap",
      transport: "webtransport",
    });
  });

  it("accepts browser dialable ws connection multiaddr", () => {
    expect(resolveConnectionEntryTargetAddress("/dns4/p2p.example.com/tcp/443/ws/p2p/12D3KooWBootstrap")).toEqual({
      connectionAddr: "/dns4/p2p.example.com/tcp/443/ws/p2p/12D3KooWBootstrap",
      transport: "ws",
    });
  });

  it("accepts canonical tls websocket connection multiaddr", () => {
    expect(resolveConnectionEntryTargetAddress("/dns4/p2p.example.com/tcp/443/tls/ws/p2p/12D3KooWBootstrap")).toEqual({
      connectionAddr: "/dns4/p2p.example.com/tcp/443/tls/ws/p2p/12D3KooWBootstrap",
      transport: "ws",
    });
  });

  it("normalizes legacy wss connection multiaddr to canonical tls/ws", () => {
    expect(resolveConnectionEntryTargetAddress("/dns4/p2p.example.com/tcp/443/wss/p2p/12D3KooWBootstrap")).toEqual({
      connectionAddr: "/dns4/p2p.example.com/tcp/443/tls/ws/p2p/12D3KooWBootstrap",
      transport: "ws",
    });
  });

  it("rejects non browser dialable connection multiaddr", () => {
    expect(() => resolveConnectionEntryTargetAddress("/ip4/156.233.234.137/tcp/8443/p2p/12D3KooWBootstrap")).toThrow(
      "连接地址必须是浏览器可拨的 multiaddr",
    );
  });

  it("reads empty server url when nothing is stored", () => {
    expect(readStoredServerUrl()).toBe("");
  });

  it("prefers stored server url over default env", () => {
    vi.stubEnv("NEXT_PUBLIC_GOMTM_PUBLIC_URL", "https://gomtm2.yuepa8.com");
    persistStoredServerUrl("https://alt.example.com");
    expect(readStoredServerUrl()).toBe("https://alt.example.com");
  });

  it("clearStoredConnectionRuntime only removes legacy runtime connection target", () => {
    window.localStorage.setItem(
      "gomtm:p2p:connection-runtime",
      JSON.stringify({ connectionAddr: "/dns4/legacy.example.com/tcp/443/ws/p2p/12D3KooWLegacy" }),
    );
    persistStoredServerUrl("https://gomtm2.yuepa8.com");

    clearStoredConnectionRuntime();

    expect(window.localStorage.getItem("gomtm:p2p:connection-runtime")).toBeNull();
    expect(readStoredServerUrl()).toBe("https://gomtm2.yuepa8.com");
  });
});
