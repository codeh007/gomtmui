import { describe, expect, it } from "vitest";
import { buildMproxyVmessWrapperProfile } from "./mproxy-vmess-wrapper";

describe("buildMproxyVmessWrapperProfile", () => {
  it("builds a gomtm wrapper profile from server origin and config wrapper secret", async () => {
    const profile = await buildMproxyVmessWrapperProfile({
      displayName: "Tokyo Extract",
      nonce: new Uint8Array(12).fill(2),
      password: "secret",
      secretB64: Buffer.alloc(32, 1).toString("base64"),
      serverOrigin: "https://gomtm.example:8443",
      trafficMode: "mitm",
      username: "mpx_user",
    });

    expect(profile.add).toBe("gomtm.example");
    expect(profile.port).toBe("8443");
    expect(profile.path).toMatch(/^\/api\/mproxy\/wsproxy\/[A-Za-z0-9_-]+$/);
  });
});
