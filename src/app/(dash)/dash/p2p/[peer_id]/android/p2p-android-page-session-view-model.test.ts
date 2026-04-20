import { describe, expect, test } from "vitest";
import { deriveNativeRemoteV2Capability } from "./p2p-android-page-session-view-model";

describe("deriveNativeRemoteV2Capability", () => {
  test("在未连接时返回 unavailable/not_connected", () => {
    expect(
      deriveNativeRemoteV2Capability({
        availability: "disconnected",
        capabilityTruth: null,
        errorMessage: null,
      }),
    ).toMatchObject({
      reason: "not_connected",
      state: "unavailable",
    });
  });

  test("在已连接但尚未发现可拨 target address 时返回 unavailable 与等待文案", () => {
    expect(
      deriveNativeRemoteV2Capability({
        availability: "disconnected",
        capabilityTruth: null,
        errorMessage: "目标节点当前没有 browser-dialable multiaddr。",
      }),
    ).toMatchObject({
      reason: "目标节点当前没有 browser-dialable multiaddr。",
      state: "unavailable",
    });
  });

  test("在 nativeRemoteV2WebRTC 需要录屏授权时返回 permission_required", () => {
    expect(
      deriveNativeRemoteV2Capability({
        availability: "available",
        capabilityTruth: {
          remoteControl: {
            capabilities: {
              nativeRemoteV2WebRTC: {
                reason: "screen_capture_not_granted",
                state: "permission_required",
              },
            },
          },
        },
        errorMessage: null,
      }),
    ).toMatchObject({
      reason: "screen_capture_not_granted",
      state: "permission_required",
    });
  });
});
