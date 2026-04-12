import { describe, expect, it } from "vitest";

import { parseDeviceStatus } from "./discovery-contracts";

describe("parseDeviceStatus", () => {
  it("reads bootstrap_connection_path instead of the old generic connection_path field", () => {
    const parsed = parseDeviceStatus({
      platform: "android",
      bootstrap_connection_path: {
        bootstrap_peer_id: "12D3KooWBootstrap",
        path: "relay",
        via_addr: "/dns4/relay.example.com/udp/4101/quic-v1/webtransport/p2p/12D3KooWBootstrap",
      },
      connection_path: {
        bootstrap_peer_id: "12D3KooWLegacy",
        path: "direct",
        via_addr: "/ip4/127.0.0.1/tcp/4101/p2p/12D3KooWLegacy",
      },
    });

    expect(parsed?.bootstrapConnectionPath).toEqual({
      bootstrapPeerId: "12D3KooWBootstrap",
      path: "relay",
      viaAddr: "/dns4/relay.example.com/udp/4101/quic-v1/webtransport/p2p/12D3KooWBootstrap",
    });
  });
});
