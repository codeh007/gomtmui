import { describe, expect, it } from "vitest";
import { parseBrowserBootstrapTruth, resolveCanonicalBootstrapState } from "./bootstrap-truth";

const LIVE_TRUTH = {
  generation: "gen-1",
  primaryTransport: "webtransport",
  candidates: [
    {
      transport: "webtransport",
      addr: "/dns4/p2p.example.com/udp/8443/quic-v1/webtransport/certhash/uEiFresh/p2p/12D3KooWBootstrap",
      priority: 100,
    },
    {
      transport: "ws",
      addr: "/dns4/p2p.example.com/tcp/443/ws/p2p/12D3KooWBootstrap",
      priority: 50,
    },
  ],
} as const;

describe("resolveCanonicalBootstrapState", () => {
  it("parses webtransport + ws browser bootstrap truth", () => {
    expect(
      parseBrowserBootstrapTruth({
        generation: LIVE_TRUTH.generation,
        primary_transport: LIVE_TRUTH.primaryTransport,
        candidates: LIVE_TRUTH.candidates,
      }),
    ).toEqual(LIVE_TRUTH);
  });

  it("rejects legacy wss browser bootstrap truth", () => {
    expect(() =>
      parseBrowserBootstrapTruth({
        generation: LIVE_TRUTH.generation,
        primary_transport: LIVE_TRUTH.primaryTransport,
        candidates: [
          LIVE_TRUTH.candidates[0],
          {
            transport: "wss",
            addr: "/dns4/p2p.example.com/tcp/443/wss/p2p/12D3KooWBootstrap",
            priority: 50,
          },
        ],
      }),
    ).toThrow();
  });

  it("rejects ws transport paired with legacy tls websocket address", () => {
    expect(() =>
      parseBrowserBootstrapTruth({
        generation: LIVE_TRUTH.generation,
        primary_transport: "ws",
        candidates: [
          LIVE_TRUTH.candidates[0],
          {
            transport: "ws",
            addr: "/dns4/p2p.example.com/tcp/443/tls/ws/p2p/12D3KooWBootstrap",
            priority: 50,
          },
        ],
      }),
    ).toThrow();
  });

  it("rejects ws transport paired with legacy wss address", () => {
    expect(() =>
      parseBrowserBootstrapTruth({
        generation: LIVE_TRUTH.generation,
        primary_transport: "ws",
        candidates: [
          LIVE_TRUTH.candidates[0],
          {
            transport: "ws",
            addr: "/dns4/p2p.example.com/tcp/443/wss/p2p/12D3KooWBootstrap",
            priority: 50,
          },
        ],
      }),
    ).toThrow();
  });

  it("prefers live candidates over stale local cache", () => {
    const result = resolveCanonicalBootstrapState({
      liveTruth: LIVE_TRUTH,
      storedBootstrapAddr: "/dns4/old.example.com/udp/8443/quic-v1/webtransport/certhash/uEiOld/p2p/12D3KooWBootstrap",
      overrideBootstrapAddr: null,
      allowOverride: false,
    });

    expect(result.mode).toBe("live");
    expect(result.selected?.addr).toBe(LIVE_TRUTH.candidates[0].addr);
    expect(result.staleStoredBootstrapAddr).toBe(
      "/dns4/old.example.com/udp/8443/quic-v1/webtransport/certhash/uEiOld/p2p/12D3KooWBootstrap",
    );
  });

  it("returns missing-live-truth when no live truth exists", () => {
    const result = resolveCanonicalBootstrapState({
      liveTruth: null,
      storedBootstrapAddr: LIVE_TRUTH.candidates[0].addr,
      overrideBootstrapAddr: null,
      allowOverride: false,
    });

    expect(result.mode).toBe("missing-live-truth");
    expect(result.selected).toBeNull();
  });

  it("blocks a non-live override until explicitly allowed", () => {
    const result = resolveCanonicalBootstrapState({
      liveTruth: LIVE_TRUTH,
      storedBootstrapAddr: LIVE_TRUTH.candidates[0].addr,
      overrideBootstrapAddr: "/dns4/manual.example.com/tcp/443/ws/p2p/12D3KooWManual",
      allowOverride: false,
    });

    expect(result.mode).toBe("blocked-override");
    expect(result.selected).toBeNull();
    expect(result.blockedOverrideBootstrapAddr).toBe("/dns4/manual.example.com/tcp/443/ws/p2p/12D3KooWManual");
  });
});
