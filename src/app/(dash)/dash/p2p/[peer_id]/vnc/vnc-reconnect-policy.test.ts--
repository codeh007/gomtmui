import { describe, expect, it } from "vitest";
import { WorkerControlRequestError } from "@/lib/p2p/worker-control";
import {
  classifyP2PVncConnectionError,
  formatP2PVncReconnectDelay,
  getP2PVncReconnectDelayMs,
} from "./vnc-reconnect-policy";

describe("classifyP2PVncConnectionError", () => {
  it("keeps retryable worker failures inside auto reconnect", () => {
    const decision = classifyP2PVncConnectionError(
      new WorkerControlRequestError("temporary upstream dial failure", {
        code: "SB_STREAM_CONNECT_FAILED",
        retryable: true,
      }),
    );

    expect(decision).toEqual({
      kind: "retry",
      message: "temporary upstream dial failure",
    });
  });

  it("treats SB_NOT_FOUND as waiting for the target instead of retrying forever", () => {
    const decision = classifyP2PVncConnectionError(
      new WorkerControlRequestError("VNC resource is not ready", {
        code: "SB_NOT_FOUND",
        retryable: false,
      }),
    );

    expect(decision).toEqual({
      kind: "wait_for_target",
      message: "VNC resource is not ready",
    });
  });

  it("keeps permission denied isolated from generic reconnect errors", () => {
    const decision = classifyP2PVncConnectionError(
      new WorkerControlRequestError("permission denied: viewer is not allowed", {
        code: "SB_PERMISSION_DENIED",
        retryable: false,
      }),
    );

    expect(decision).toEqual({
      kind: "permission_denied",
      message: "permission denied: viewer is not allowed",
    });
  });

  it("surfaces explicit protocol failures as fatal instead of reconnecting", () => {
    const decision = classifyP2PVncConnectionError(new Error("invalid stream.open response"));

    expect(decision).toEqual({
      kind: "fatal",
      message: "invalid stream.open response",
    });
  });
});

describe("P2P VNC reconnect delays", () => {
  it("caps backoff at the last configured delay", () => {
    expect(getP2PVncReconnectDelayMs(0)).toBe(1200);
    expect(getP2PVncReconnectDelayMs(20)).toBe(12000);
    expect(formatP2PVncReconnectDelay(2500)).toBe("2.5 秒");
  });
});
