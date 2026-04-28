import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getUser: vi.fn(),
  rpc: vi.fn(),
}));

vi.mock("mtmsdk/supabase/supabase", () => ({
  getSupabase: vi.fn(() => ({
    auth: {
      getUser: mocks.getUser,
    },
    rpc: mocks.rpc,
  })),
}));

import { mproxyRoute } from "./mproxy";

describe("mproxy vmess control-plane routes", () => {
  const extractId = "11111111-1111-4111-8111-111111111111";

  beforeEach(() => {
    mocks.getUser.mockReset();
    mocks.rpc.mockReset();
  });

  it("requires an authenticated dashboard user", async () => {
    mocks.getUser.mockResolvedValue({
      data: { user: null },
      error: null,
    });

    const response = await mproxyRoute.request(`http://localhost/mproxy/extracts/${extractId}/vmess/profile`);

    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toMatchObject({ error: "unauthorized" });
    expect(mocks.rpc).not.toHaveBeenCalled();
  });

  it("builds vmess output from the current user's extract list row", async () => {
    mocks.getUser.mockResolvedValue({
      data: { user: { id: "owner-1" } },
      error: null,
    });
    mocks.rpc.mockResolvedValue({
      data: [
        {
          allow_plain_proxy: true,
          allow_vmess_wrapper: true,
          disabled: false,
          display_name: "Tokyo VMess",
          expires_at: "2026-05-01T00:00:00.000Z",
          id: extractId,
          password: "secret",
          traffic_mode: "mitm",
          upstream_id: "22222222-2222-4222-8222-222222222222",
          upstream_outbound: {
            server: "jp.example.com",
            server_port: 443,
            tls: { enabled: true, server_name: "jp.example.com" },
            type: "vmess",
            uuid: "33333333-3333-4333-8333-333333333333",
          },
          upstream_protocol: "vmess",
          upstream_source_name: "manual",
          upstream_subscription_id: null,
          upstream_tag: "jp-direct-vmess",
          username: "mpx_user",
        },
      ],
      error: null,
    });

    const response = await mproxyRoute.request(`http://localhost/mproxy/extracts/${extractId}/vmess/profile`);

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      extract_id: extractId,
      traffic_mode: "mitm",
      upstream_protocol: "vmess",
      upstream_tag: "jp-direct-vmess",
      uri: expect.stringMatching(/^vmess:\/\//),
    });
    expect(mocks.rpc).toHaveBeenCalledWith("mproxy_extract_list");
  });

  it("rejects extracts without vmess wrapper enabled", async () => {
    mocks.getUser.mockResolvedValue({
      data: { user: { id: "owner-1" } },
      error: null,
    });
    mocks.rpc.mockResolvedValue({
      data: [
        {
          allow_plain_proxy: true,
          allow_vmess_wrapper: false,
          disabled: false,
          display_name: "Tokyo VMess",
          expires_at: "2026-05-01T00:00:00.000Z",
          id: extractId,
          password: "secret",
          traffic_mode: "standard",
          upstream_id: "22222222-2222-4222-8222-222222222222",
          upstream_outbound: {
            server: "jp.example.com",
            server_port: 443,
            type: "vmess",
            uuid: "33333333-3333-4333-8333-333333333333",
          },
          upstream_protocol: "vmess",
          upstream_source_name: "manual",
          upstream_subscription_id: null,
          upstream_tag: "jp-direct-vmess",
          username: "mpx_user",
        },
      ],
      error: null,
    });

    const response = await mproxyRoute.request(`http://localhost/mproxy/extracts/${extractId}/vmess/profile`);

    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toMatchObject({ error: "vmess wrapper is disabled for this extract" });
  });
});
