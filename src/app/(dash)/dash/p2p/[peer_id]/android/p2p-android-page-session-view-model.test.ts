import { describe, expect, test } from "vitest";
import { buildAndroidNativeRemoteV2SessionModel } from "./p2p-android-page-session-view-model";

describe("buildAndroidNativeRemoteV2SessionModel", () => {
  test("在已连接但尚未发现可拨 target address 时返回等待状态", () => {
    expect(
      buildAndroidNativeRemoteV2SessionModel({
        capabilityTruth: null,
        isConnected: true,
        networkErrorMessage: null,
        peerTruthErrorMessage: null,
        targetAddress: null,
      }),
    ).toMatchObject({
      availability: "unavailable",
      phase: "waiting_for_target",
      transportPhase: "waiting_for_target",
    });
  });

  test("在 nativeRemoteV2 需要录屏授权时返回 permission_required", () => {
    expect(
      buildAndroidNativeRemoteV2SessionModel({
        capabilityTruth: {
          remoteControl: {
            capabilities: {
              nativeRemoteV2: {
                reason: "screen_capture_not_granted",
                state: "permission_required",
              },
            },
          },
        },
        isConnected: true,
        networkErrorMessage: null,
        peerTruthErrorMessage: null,
        targetAddress: "/ip4/127.0.0.1/tcp/4101/p2p/12D3KooWAndroid",
      }),
    ).toMatchObject({
      availability: "permission_required",
      phase: "permission_required",
      transportPhase: "ready",
    });
  });
});
