import { describe, expect, it } from "vitest";
import { normalizeBrowserBootstrapAddr, resolveBootstrapTarget } from "./p2p-bootstrap-storage";

describe("p2p-bootstrap-storage", () => {
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

  it("accepts browser dialable wss bootstrap multiaddr", () => {
    expect(resolveBootstrapTarget("/dns4/p2p.example.com/tcp/443/tls/ws/p2p/12D3KooWBootstrap")).toEqual({
      bootstrapAddr: "/dns4/p2p.example.com/tcp/443/tls/ws/p2p/12D3KooWBootstrap",
      transport: "wss",
    });
  });

  it("rejects non browser dialable bootstrap multiaddr", () => {
    expect(() => resolveBootstrapTarget("/ip4/156.233.234.137/tcp/8443/p2p/12D3KooWBootstrap")).toThrow(
      "bootstrap 地址必须是浏览器可拨的 multiaddr",
    );
  });
});
