import { parsePeerCapabilityTruthDocument } from "@/lib/p2p/discovery-contracts";
import { describe, expect, it } from "vitest";
import { normalizeRuntimeCapabilities } from "./p2p-runtime-contract";

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
});
