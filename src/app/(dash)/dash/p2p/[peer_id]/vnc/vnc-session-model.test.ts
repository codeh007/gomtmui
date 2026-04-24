import { describe, expect, it } from "vitest";
import { buildVncSessionModel } from "./vnc-session-model";

describe("buildVncSessionModel", () => {
  it("returns the current peer session state plus derived availability", () => {
    expect(
      buildVncSessionModel({
        peerId: "peer-1",
        peerSession: {
          peerId: "peer-1",
          peerTruth: null,
          peerTruthErrorMessage: "not ready",
          peerTruthStatus: "error",
        },
      }),
    ).toEqual({
      peerId: "peer-1",
      peerTruth: null,
      peerTruthErrorMessage: "not ready",
      peerTruthStatus: "error",
      availability: "preparing",
    });
  });

  it("fails closed when peer truth is ready but only exposes android remote truth", () => {
    expect(
      buildVncSessionModel({
        peerId: "peer-1",
        peerSession: {
          peerId: "peer-1",
          peerTruth: {
            remoteControl: {
              capabilities: {
                nativeRemoteV2WebRTC: {
                  state: "available",
                },
              },
            },
          },
          peerTruthErrorMessage: null,
          peerTruthStatus: "ready",
        },
      }),
    ).toEqual({
      peerId: "peer-1",
      peerTruth: {
        remoteControl: {
          capabilities: {
            nativeRemoteV2WebRTC: {
              state: "available",
            },
          },
        },
      },
      peerTruthErrorMessage: null,
      peerTruthStatus: "ready",
      availability: "unavailable",
    });
  });
});
