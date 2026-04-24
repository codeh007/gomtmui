import { describe, expect, it } from "vitest";
import { getVncReconnectDelayMs } from "./vnc-reconnect-policy";

describe("getVncReconnectDelayMs", () => {
  it("backs off across retries", () => {
    expect(getVncReconnectDelayMs(1)).toBe(1000);
    expect(getVncReconnectDelayMs(2)).toBe(2000);
    expect(getVncReconnectDelayMs(3)).toBe(5000);
  });
});
