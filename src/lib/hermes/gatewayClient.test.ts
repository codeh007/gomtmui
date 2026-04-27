import { describe, expect, it } from "vitest";

import { buildGatewayWebSocketUrl } from "./gatewayClient";

describe("buildGatewayWebSocketUrl", () => {
  it("builds a wss://.../api/hermes/ws?token=... URL for an https gomtm origin", () => {
    expect(
      buildGatewayWebSocketUrl(
        "https://selected.example.com",
        "session-token-123",
      ),
    ).toBe(
      "wss://selected.example.com/api/hermes/ws?token=session-token-123",
    );
  });

  it("builds a ws://.../api/hermes/ws?token=... URL for an http gomtm origin", () => {
    expect(
      buildGatewayWebSocketUrl(
        "http://selected.example.com",
        "session-token-123",
      ),
    ).toBe(
      "ws://selected.example.com/api/hermes/ws?token=session-token-123",
    );
  });
});
