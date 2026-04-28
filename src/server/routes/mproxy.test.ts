import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getUser: vi.fn(),
  generateMproxyCA: vi.fn(),
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

vi.mock("../lib/mproxy-ca", () => ({
  generateMproxyCA: mocks.generateMproxyCA,
}));

import { mproxyRoute } from "./mproxy";

describe("mproxy vmess control-plane routes", () => {
  const extractId = "11111111-1111-4111-8111-111111111111";

  beforeEach(() => {
    mocks.getUser.mockReset();
    mocks.generateMproxyCA.mockReset();
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

  it("returns the current CA state for an authenticated user", async () => {
    mocks.getUser.mockResolvedValue({
      data: { user: { id: "user-1" } },
      error: null,
    });
    mocks.rpc.mockImplementation(async (name: string) => {
      if (name === "mproxy_ca_state_get") {
        return {
          data: [
            {
              download_path: "/api/mproxy/mitm/ca.crt",
              file_name: "gomtm-mitm-ca.crt",
              initialized: true,
              not_after: "2036-01-01T00:00:00.000Z",
              not_before: "2026-01-01T00:00:00.000Z",
              sha256_fingerprint: "a".repeat(64),
              subject_common_name: "Gomtm MITM Proxy CA",
            },
          ],
          error: null,
        };
      }

      throw new Error(`unexpected rpc ${name}`);
    });

    const response = await mproxyRoute.request("http://localhost/mproxy/mitm/ca/state");

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      download_path: "/api/mproxy/mitm/ca.crt",
      file_name: "gomtm-mitm-ca.crt",
      initialized: true,
      subject_common_name: "Gomtm MITM Proxy CA",
    });
  });

  it("rejects unauthenticated CA state reads", async () => {
    mocks.getUser.mockResolvedValue({
      data: { user: null },
      error: null,
    });

    const response = await mproxyRoute.request("http://localhost/mproxy/mitm/ca/state");

    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toMatchObject({ error: "unauthorized" });
    expect(mocks.rpc).not.toHaveBeenCalled();
  });

  it("rejects unauthenticated CA initialization", async () => {
    mocks.getUser.mockResolvedValue({
      data: { user: null },
      error: null,
    });

    const response = await mproxyRoute.request("http://localhost/mproxy/mitm/ca/init", { method: "POST" });

    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toMatchObject({ error: "unauthorized" });
    expect(mocks.rpc).not.toHaveBeenCalled();
    expect(mocks.generateMproxyCA).not.toHaveBeenCalled();
  });

  it("rejects non-admin CA initialization", async () => {
    mocks.getUser.mockResolvedValue({
      data: { user: { id: "user-1" } },
      error: null,
    });
    mocks.rpc.mockImplementation(async (name: string) => {
      if (name === "has_permission") {
        return { data: false, error: null };
      }

      throw new Error(`unexpected rpc ${name}`);
    });

    const response = await mproxyRoute.request("http://localhost/mproxy/mitm/ca/init", { method: "POST" });

    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toMatchObject({ error: "forbidden" });
    expect(mocks.rpc).toHaveBeenCalledWith("has_permission", {
      p_action: "manage",
      p_resource: "user_roles",
    });
    expect(mocks.generateMproxyCA).not.toHaveBeenCalled();
  });

  it("initializes CA for an authenticated admin", async () => {
    mocks.getUser.mockResolvedValue({
      data: { user: { id: "admin-1" } },
      error: null,
    });
    mocks.generateMproxyCA.mockResolvedValue({
      certPem: "-----BEGIN CERTIFICATE-----\nTEST\n-----END CERTIFICATE-----",
      notAfter: "2036-01-01T00:00:00.000Z",
      notBefore: "2026-01-01T00:00:00.000Z",
      privateKeyPem: "-----BEGIN RSA PRIVATE KEY-----\nTEST\n-----END RSA PRIVATE KEY-----",
      sha256Fingerprint: "a".repeat(64),
      subjectCommonName: "Gomtm MITM Proxy CA",
    });
    mocks.rpc.mockImplementation(async (name: string) => {
      if (name === "has_permission") {
        return { data: true, error: null };
      }
      if (name === "mproxy_ca_init") {
        return {
          data: [
            {
              download_path: "/api/mproxy/mitm/ca.crt",
              file_name: "gomtm-mitm-ca.crt",
              initialized: true,
              not_after: "2036-01-01T00:00:00.000Z",
              not_before: "2026-01-01T00:00:00.000Z",
              sha256_fingerprint: "a".repeat(64),
              subject_common_name: "Gomtm MITM Proxy CA",
            },
          ],
          error: null,
        };
      }

      throw new Error(`unexpected rpc ${name}`);
    });

    const response = await mproxyRoute.request("http://localhost/mproxy/mitm/ca/init", { method: "POST" });

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      initialized: true,
      subject_common_name: "Gomtm MITM Proxy CA",
    });
    expect(mocks.generateMproxyCA).toHaveBeenCalledTimes(1);
    expect(mocks.rpc).toHaveBeenCalledWith("has_permission", {
      p_action: "manage",
      p_resource: "user_roles",
    });
    expect(mocks.rpc).toHaveBeenCalledWith("mproxy_ca_init", {
      p_cert_pem: "-----BEGIN CERTIFICATE-----\nTEST\n-----END CERTIFICATE-----",
      p_not_after: "2036-01-01T00:00:00.000Z",
      p_not_before: "2026-01-01T00:00:00.000Z",
      p_private_key_pem: "-----BEGIN RSA PRIVATE KEY-----\nTEST\n-----END RSA PRIVATE KEY-----",
      p_sha256_fingerprint: "a".repeat(64),
      p_subject_common_name: "Gomtm MITM Proxy CA",
    });
  });
});
