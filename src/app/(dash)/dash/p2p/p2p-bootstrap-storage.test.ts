// @vitest-environment jsdom

import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  clearStoredBootstrapRuntime,
  normalizeBrowserBootstrapAddr,
  persistStoredBootstrapServerUrl,
  readStoredBootstrapServerUrl,
  resolveBootstrapTarget,
} from "./p2p-bootstrap-storage";

describe("p2p-bootstrap-storage", () => {
  beforeEach(() => {
    window.localStorage.clear();
    vi.unstubAllEnvs();
  });

  it("keeps only the first certhash for webtransport bootstrap addr", () => {
    expect(
      normalizeBrowserBootstrapAddr(
        "/ip4/156.233.234.137/udp/4101/quic-v1/webtransport/certhash/uEiFirst/certhash/uEiSecond/p2p/12D3KooWBootstrap",
      ),
    ).toBe("/ip4/156.233.234.137/udp/4101/quic-v1/webtransport/certhash/uEiFirst/p2p/12D3KooWBootstrap");
  });

  it("accepts browser dialable webtransport bootstrap multiaddr", () => {
    expect(
      resolveBootstrapTarget("/dns4/p2p.example.com/udp/8443/quic-v1/webtransport/certhash/uEiTest/p2p/12D3KooWBootstrap"),
    ).toEqual({
      bootstrapAddr: "/dns4/p2p.example.com/udp/8443/quic-v1/webtransport/certhash/uEiTest/p2p/12D3KooWBootstrap",
      transport: "webtransport",
    });
  });

  it("accepts browser dialable ws bootstrap multiaddr", () => {
    expect(resolveBootstrapTarget("/dns4/p2p.example.com/tcp/443/ws/p2p/12D3KooWBootstrap")).toEqual({
      bootstrapAddr: "/dns4/p2p.example.com/tcp/443/ws/p2p/12D3KooWBootstrap",
      transport: "ws",
    });
  });

  it("accepts canonical tls websocket bootstrap multiaddr", () => {
    expect(resolveBootstrapTarget("/dns4/p2p.example.com/tcp/443/tls/ws/p2p/12D3KooWBootstrap")).toEqual({
      bootstrapAddr: "/dns4/p2p.example.com/tcp/443/tls/ws/p2p/12D3KooWBootstrap",
      transport: "ws",
    });
  });

  it("normalizes legacy wss bootstrap multiaddr to canonical tls/ws", () => {
    expect(resolveBootstrapTarget("/dns4/p2p.example.com/tcp/443/wss/p2p/12D3KooWBootstrap")).toEqual({
      bootstrapAddr: "/dns4/p2p.example.com/tcp/443/tls/ws/p2p/12D3KooWBootstrap",
      transport: "ws",
    });
  });

  it("rejects non browser dialable bootstrap multiaddr", () => {
    expect(() => resolveBootstrapTarget("/ip4/156.233.234.137/tcp/8443/p2p/12D3KooWBootstrap")).toThrow(
      "bootstrap 地址必须是浏览器可拨的 multiaddr",
    );
  });

  it("reads empty server url when nothing is stored", () => {
    expect(readStoredBootstrapServerUrl()).toBe("");
  });

  it("prefers stored server url over default env", () => {
    vi.stubEnv("NEXT_PUBLIC_GOMTM_PUBLIC_URL", "https://gomtm2.yuepa8.com");
    persistStoredBootstrapServerUrl("https://alt.example.com");
    expect(readStoredBootstrapServerUrl()).toBe("https://alt.example.com");
  });

  it("clearStoredBootstrapRuntime only removes legacy runtime bootstrap target", () => {
    window.localStorage.setItem(
      "gomtm:p2p:bootstrap-target",
      JSON.stringify({ bootstrapAddr: "/dns4/legacy.example.com/tcp/443/ws/p2p/12D3KooWLegacy" }),
    );
    persistStoredBootstrapServerUrl("https://gomtm2.yuepa8.com");

    clearStoredBootstrapRuntime();

    expect(window.localStorage.getItem("gomtm:p2p:bootstrap-target")).toBeNull();
    expect(readStoredBootstrapServerUrl()).toBe("https://gomtm2.yuepa8.com");
  });
});
