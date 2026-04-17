// @vitest-environment jsdom

import { describe, expect, it } from "vitest";

import { parsePublicConnectionMetadata } from "./connection-truth";

describe("parsePublicConnectionMetadata", () => {
  it("accepts the canonical gomtm connection metadata contract", () => {
    expect(
      parsePublicConnectionMetadata({
        version: 2,
        server: {
          public_url: "https://gomtm2.yuepa8.com",
        },
        p2p: {
          enabled: true,
          generation: "gen-1",
        },
        browser: {
          generation: "gen-1",
          primary_transport: "ws",
          candidates: [
            {
              transport: "ws",
              addr: "/dns4/gomtm2.yuepa8.com/tcp/443/ws/p2p/12D3KooWBootstrap",
              priority: 50,
            },
          ],
        },
      }),
    ).toMatchObject({
      version: 2,
      server: {
        publicUrl: "https://gomtm2.yuepa8.com",
      },
      p2p: {
        enabled: true,
        generation: "gen-1",
      },
      browser: {
        generation: "gen-1",
        primaryTransport: "ws",
      },
    });
  });

  it("rejects removed legacy envelope", () => {
    expect(() =>
      parsePublicConnectionMetadata({
        version: 1,
        server: {
          public_url: "https://gomtm2.yuepa8.com",
        },
        p2p: {
          enabled: true,
          generation: "gen-1",
          browser: {
            generation: "gen-1",
            primary_transport: "ws",
            candidates: [
              {
                transport: "ws",
                addr: "/dns4/gomtm2.yuepa8.com/tcp/443/ws/p2p/12D3KooWBootstrap",
                priority: 50,
              },
            ],
          },
        },
      }),
    ).toThrow();
  });
});
