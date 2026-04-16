import { describe, expect, it } from "vitest";
import {
  parseBrowserBootstrapTruth,
  parsePublicBootstrapMetadata,
  resolveCanonicalBootstrapState,
} from "./bootstrap-truth";

const LIVE_TRUTH = {
  generation: "gen-1",
  primary_transport: "webtransport",
  candidates: [
    {
      transport: "webtransport",
      addr: "/dns4/gomtm2.yuepa8.com/udp/8443/quic-v1/webtransport/certhash/uEiTest/p2p/12D3KooWBootstrap",
      priority: 100,
    },
    {
      transport: "ws",
      addr: "/dns4/gomtm2.yuepa8.com/tcp/443/ws/p2p/12D3KooWBootstrap",
      priority: 50,
    },
  ],
};

describe("resolveCanonicalBootstrapState", () => {
  it("parses webtransport + ws browser bootstrap truth", () => {
    expect(
      parseBrowserBootstrapTruth({
        generation: "gen-1",
        primary_transport: "webtransport",
        candidates: LIVE_TRUTH.candidates,
      }),
    ).toMatchObject({
      generation: "gen-1",
      primaryTransport: "webtransport",
      candidates: [
        {
          transport: "webtransport",
          addr: "/dns4/gomtm2.yuepa8.com/udp/8443/quic-v1/webtransport/certhash/uEiTest/p2p/12D3KooWBootstrap",
        },
        {
          transport: "ws",
          addr: "/dns4/gomtm2.yuepa8.com/tcp/443/ws/p2p/12D3KooWBootstrap",
        },
      ],
    });
  });

  it("parses public bootstrap metadata and exposes server url + browser truth", () => {
    expect(
      parsePublicBootstrapMetadata({
        version: 1,
        server: {
          public_url: "https://gomtm2.yuepa8.com",
        },
        p2p: {
          enabled: true,
          generation: "gen-1",
          browser: LIVE_TRUTH,
        },
      }),
    ).toEqual({
      version: 1,
      server: {
        publicUrl: "https://gomtm2.yuepa8.com",
      },
      p2p: {
        enabled: true,
        generation: "gen-1",
        browser: {
          generation: "gen-1",
          primaryTransport: "webtransport",
          candidates: [
            {
              transport: "webtransport",
              addr: "/dns4/gomtm2.yuepa8.com/udp/8443/quic-v1/webtransport/certhash/uEiTest/p2p/12D3KooWBootstrap",
              priority: 100,
            },
            {
              transport: "ws",
              addr: "/dns4/gomtm2.yuepa8.com/tcp/443/ws/p2p/12D3KooWBootstrap",
              priority: 50,
            },
          ],
        },
      },
    });
  });

  it("rejects legacy wss browser bootstrap truth", () => {
    expect(() =>
      parseBrowserBootstrapTruth({
        generation: "gen-1",
        primary_transport: "ws",
        candidates: [
          {
            transport: "ws",
            addr: "/dns4/gomtm2.yuepa8.com/tcp/443/wss/p2p/12D3KooWBootstrap",
            priority: 100,
          },
        ],
      }),
    ).toThrow("ws transport must use canonical /ws multiaddr without legacy secure websocket segments");
  });

  it("prefers live bootstrap truth when present", () => {
    const state = resolveCanonicalBootstrapState({
      liveTruth: parseBrowserBootstrapTruth(LIVE_TRUTH),
      storedBootstrapAddr: "/dns4/old.example.com/udp/8443/quic-v1/webtransport/certhash/uEiOld/p2p/12D3KooWOld",
      overrideBootstrapAddr: null,
      allowOverride: false,
    });

    expect(state).toMatchObject({
      mode: "live",
      selected: {
        transport: "webtransport",
        addr: "/dns4/gomtm2.yuepa8.com/udp/8443/quic-v1/webtransport/certhash/uEiTest/p2p/12D3KooWBootstrap",
      },
      staleStoredBootstrapAddr: "/dns4/old.example.com/udp/8443/quic-v1/webtransport/certhash/uEiOld/p2p/12D3KooWOld",
    });
  });
});
