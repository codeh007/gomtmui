import { describe, expect, it } from "vitest";
import { normalizeBrowserMultiaddr, sameBrowserMultiaddr } from "./browser-multiaddr";

describe("normalizeBrowserMultiaddr", () => {
  it("deduplicates repeated webtransport certhash segments", () => {
    const input =
      "/dns4/p2p.example.com/udp/443/quic-v1/webtransport/certhash/uEiFresh/certhash/uEiStale/p2p/12D3KooWBootstrap";

    expect(normalizeBrowserMultiaddr(input)).toBe(
      "/dns4/p2p.example.com/udp/443/quic-v1/webtransport/certhash/uEiFresh/p2p/12D3KooWBootstrap",
    );
  });
});

describe("sameBrowserMultiaddr", () => {
  it("treats duplicated certhash variants as the same browser multiaddr", () => {
    const left =
      "/dns4/p2p.example.com/udp/443/quic-v1/webtransport/certhash/uEiFresh/certhash/uEiStale/p2p/12D3KooWBootstrap";
    const right = "/dns4/p2p.example.com/udp/443/quic-v1/webtransport/certhash/uEiFresh/p2p/12D3KooWBootstrap";

    expect(sameBrowserMultiaddr(left, right)).toBe(true);
  });
});
