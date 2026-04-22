import { parsePeerCapabilityTruthDocument } from "@/lib/p2p/discovery-contracts";
import { describe, expect, it } from "vitest";
import { normalizeRuntimeCapabilities } from "./p2p-runtime-contract";
import { resolveMissingPeerTruth } from "./use-browser-p2p-runtime";

describe("browser capability runtime hard cut", () => {
  it("parses snake_case direct truth documents without descriptor recursion", () => {
    expect(
      parsePeerCapabilityTruthDocument({
        remote_control: {
          capabilities: {
            native_remote_v2_webrtc: {
              reason: "ready",
              state: "available",
            },
          },
          platform: "android",
        },
      }),
    ).toEqual({
      remoteControl: {
        capabilities: {
          nativeRemoteV2WebRTC: {
            reason: "ready",
            state: "available",
          },
        },
      },
    });
  });

  it("parses canonical camelCase direct truth documents", () => {
    expect(
      parsePeerCapabilityTruthDocument({
        connectionPath: {
          connectionPeerId: "12D3KooWRelay",
          path: "relay",
          viaAddr: "/dns4/relay.example.com/tcp/443/tls/ws",
        },
        remoteControl: {
          capabilities: {
            nativeRemoteV2WebRTC: {
              reason: "ready",
              state: "available",
            },
          },
        },
      }),
    ).toEqual({
      connectionPath: {
        connectionPeerId: "12D3KooWRelay",
        path: "relay",
        viaAddr: "/dns4/relay.example.com/tcp/443/tls/ws",
      },
      remoteControl: {
        capabilities: {
          nativeRemoteV2WebRTC: {
            reason: "ready",
            state: "available",
          },
        },
      },
    });
  });

  it("preserves camelCase truth from peer_capability_truth meta payloads", () => {
    expect(
      normalizeRuntimeCapabilities([
        {
          meta: {
            truth: {
              remoteControl: {
                capabilities: {
                  nativeRemoteV2WebRTC: {
                    reason: "ready",
                    state: "available",
                  },
                },
              },
            },
          },
          name: "peer_capability_truth",
        },
      ]),
    ).toEqual([{ name: "android.native_remote_v2_webrtc", reason: "ready", state: "available" }]);
  });

  it("treats empty capability probes as retryable empty outcomes and preserves later generic descriptors during background hydration", async () => {
    const first = await resolveMissingPeerTruth({
      candidates: [
        {
          lastDiscoveredAt: "2026-04-21T16:00:00.000Z",
          multiaddrs: ["/dns4/peer.example.com/tcp/443/tls/ws/p2p/12D3KooWPeer"],
          peerId: "12D3KooWPeer",
        },
      ],
      node: {} as never,
      requestCapabilities: async () => [],
      resolveDialableAddress: async () => "/dns4/peer.example.com/tcp/443/tls/ws/p2p/12D3KooWPeer",
      resolvedPeerCapabilities: {},
      resolvedPeerTruth: {},
    });

    expect(first.resolvedPeerCapabilities["12D3KooWPeer"]).toEqual([]);
    expect(first.resolvedPeerTruth["12D3KooWPeer"]).toBeUndefined();
    expect(first.retryablePeerKeys).toEqual(["12D3KooWPeer\n/dns4/peer.example.com/tcp/443/tls/ws/p2p/12D3KooWPeer"]);

    const second = await resolveMissingPeerTruth({
      candidates: [
        {
          lastDiscoveredAt: "2026-04-21T16:00:00.000Z",
          multiaddrs: ["/dns4/peer.example.com/tcp/443/tls/ws/p2p/12D3KooWPeer"],
          peerId: "12D3KooWPeer",
        },
      ],
      node: {} as never,
      requestCapabilities: async () => [
        { name: "android.native_remote_v2_webrtc", reason: "", state: "available" },
        { name: "linux.web_ssh", reason: "not_supported", state: "unavailable" },
      ],
      resolveDialableAddress: async () => "/dns4/peer.example.com/tcp/443/tls/ws/p2p/12D3KooWPeer",
      resolvedPeerCapabilities: first.resolvedPeerCapabilities,
      resolvedPeerTruth: first.resolvedPeerTruth,
    });

    expect(second.resolvedPeerCapabilities["12D3KooWPeer"]).toEqual([
      { name: "android.native_remote_v2_webrtc", reason: "", state: "available" },
      { name: "linux.web_ssh", reason: "not_supported", state: "unavailable" },
    ]);
    expect(second.resolvedPeerTruth["12D3KooWPeer"]?.remoteControl?.capabilities.nativeRemoteV2WebRTC?.state).toBe("available");
  });
});
