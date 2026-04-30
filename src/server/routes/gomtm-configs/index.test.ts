import { Hono } from "hono";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ApiPrefix } from "@/server/context";
import { serverRoute } from "@/server/routes/server";
import { signRuntimeConfigPath, verifyRuntimeConfigSignature } from "./signing";

const authGetUser = vi.fn();
const rpc = vi.fn();

vi.mock("mtmsdk/supabase/supabase", () => ({
  getSupabase: () => ({
    auth: {
      getUser: authGetUser,
    },
    rpc,
  }),
}));

const app = new Hono();
app.route(ApiPrefix, serverRoute);

const trustedDashboardHeaders = {
  origin: "http://example.com",
  "sec-fetch-site": "same-origin",
};

describe("gomtm config control-plane routes", () => {
  beforeEach(() => {
    process.env.GOMTM_RUNTIME_CONFIG_SIGNING_SECRET = "test-secret";
    authGetUser.mockReset();
    rpc.mockReset();
    authGetUser.mockResolvedValue({
      data: { user: { id: "user-1" } },
      error: null,
    });
  });

  afterEach(() => {
    delete process.env.GOMTM_RUNTIME_CONFIG_SIGNING_SECRET;
  });

  it("accepts a valid runtime config signature", () => {
    const signed = signRuntimeConfigPath({
      basePath: "/api/cf/gomtm/runtime-configs/custom1",
      expiresAt: 1_900_000_000,
      secret: "test-secret",
    });

    expect(
      verifyRuntimeConfigSignature({
        basePath: "/api/cf/gomtm/runtime-configs/custom1",
        expiresAt: signed.expiresAt,
        signature: signed.signature,
        secret: "test-secret",
        now: signed.expiresAt - 1,
      }),
    ).toBe(true);
  });

  it("rejects a runtime config signature when the signed path is tampered with", () => {
    const signed = signRuntimeConfigPath({
      basePath: "/api/cf/gomtm/runtime-configs/custom1",
      expiresAt: 1_900_000_000,
      secret: "test-secret",
    });

    expect(
      verifyRuntimeConfigSignature({
        basePath: "/api/cf/gomtm/runtime-configs/custom2",
        expiresAt: signed.expiresAt,
        signature: signed.signature,
        secret: "test-secret",
        now: signed.expiresAt - 1,
      }),
    ).toBe(false);
  });

  it("rejects an expired runtime config signature", () => {
    expect(
      verifyRuntimeConfigSignature({
        basePath: "/api/cf/gomtm/runtime-configs/custom1",
        expiresAt: 100,
        signature: "bad",
        secret: "test-secret",
        now: 101,
      }),
    ).toBe(false);
  });

  it("lists gomtm config profiles from the control-plane API", async () => {
    rpc.mockResolvedValueOnce({
      data: [{ name: "custom1", description: "Demo profile", updated_at: "2026-04-29T03:00:00Z" }],
      error: null,
    });

    const response = await app.request("http://example.com/api/cf/gomtm/config-profiles", {
      headers: trustedDashboardHeaders,
    });

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      items: [{ name: "custom1", description: "Demo profile", updated_at: "2026-04-29T03:00:00Z" }],
    });
    expect(rpc).toHaveBeenCalledWith("gomtm_config_profile_list_cursor", {
      p_limit: 200,
      p_offset: 0,
    });
  });

  it("rejects cross-site control-plane reads even when cookie auth exists", async () => {
    const response = await app.request("http://example.com/api/cf/gomtm/config-profiles", {
      headers: {
        origin: "http://evil.example",
        "sec-fetch-site": "cross-site",
      },
    });

    expect(response.status).toBe(403);
    expect(await response.json()).toEqual({ error: "forbidden" });
    expect(rpc).not.toHaveBeenCalled();
  });

  it("returns a stable control-plane error when listing profiles fails", async () => {
    rpc.mockResolvedValueOnce({
      data: null,
      error: { code: "XX000", message: "database exploded: secret details" },
    });

    const response = await app.request("http://example.com/api/cf/gomtm/config-profiles", {
      headers: trustedDashboardHeaders,
    });

    expect(response.status).toBe(500);
    expect(await response.json()).toEqual({ error: "failed to list config profiles" });
  });

  it("loads a singleton config profile from an array-shaped RPC response", async () => {
    rpc.mockResolvedValueOnce({
      data: [{ name: "custom1", description: "Demo profile", config_yaml: "kind: worker\nname: custom1\n" }],
      error: null,
    });

    const response = await app.request("http://example.com/api/cf/gomtm/config-profiles/custom1", {
      headers: trustedDashboardHeaders,
    });

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      name: "custom1",
      description: "Demo profile",
      config_yaml: "kind: worker\nname: custom1\n",
    });
  });

  it("creates a singleton config profile through the current-document upsert RPC", async () => {
    rpc.mockResolvedValueOnce({
      data: [],
      error: null,
    });
    rpc.mockResolvedValueOnce({
      data: [{ name: "custom1", description: "desc", config_yaml: "server:\n  listen: :8383\n" }],
      error: null,
    });

    const response = await app.request("http://example.com/api/cf/gomtm/config-profiles", {
      method: "POST",
      headers: {
        ...trustedDashboardHeaders,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        name: "custom1",
        description: "desc",
        config_yaml: "server:\n  listen: :8383\n",
      }),
    });

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      name: "custom1",
      description: "desc",
      config_yaml: "server:\n  listen: :8383\n",
    });
    expect(rpc).toHaveBeenNthCalledWith(1, "gomtm_config_profile_get", {
      p_name: "custom1",
    });
    expect(rpc).toHaveBeenNthCalledWith(2, "gomtm_config_profile_upsert", {
      p_name: "custom1",
      p_description: "desc",
      p_config_yaml: "server:\n  listen: :8383\n",
    });
  });

  it("injects vmess wrapper_secret before creating a config profile", async () => {
    rpc.mockResolvedValueOnce({
      data: [],
      error: null,
    });
    rpc.mockResolvedValueOnce({
      data: [{ name: "custom1", description: "desc", config_yaml: "kind: worker\nname: custom1\n" }],
      error: null,
    });

    const response = await app.request("http://example.com/api/cf/gomtm/config-profiles", {
      method: "POST",
      headers: {
        ...trustedDashboardHeaders,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        name: "custom1",
        description: "desc",
        config_yaml: [
          "mproxy:",
          "  runtime:",
          "    enable: true",
          "  entries:",
          "    vmess:",
          "      enable: true",
          "      transport: ws",
          "",
        ].join("\n"),
      }),
    });

    expect(response.status).toBe(200);
    expect(rpc).toHaveBeenNthCalledWith(
      2,
      "gomtm_config_profile_upsert",
      expect.objectContaining({
        p_name: "custom1",
        p_config_yaml: expect.stringContaining("wrapper_secret:"),
      }),
    );
  });

  it("returns 400 for malformed config yaml when creating a config profile", async () => {
    const response = await app.request("http://example.com/api/cf/gomtm/config-profiles", {
      method: "POST",
      headers: {
        ...trustedDashboardHeaders,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        name: "custom1",
        description: "desc",
        config_yaml: "mproxy:\n  entries:\n    vmess: [\n",
      }),
    });

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ error: "invalid config_yaml" });
    expect(rpc).not.toHaveBeenCalled();
  });

  it("returns 409 when creating a profile whose name already exists", async () => {
    rpc.mockResolvedValueOnce({
      data: [{ name: "custom1", description: "existing", config_yaml: "kind: worker\nname: custom1\n" }],
      error: null,
    });

    const response = await app.request("http://example.com/api/cf/gomtm/config-profiles", {
      method: "POST",
      headers: {
        ...trustedDashboardHeaders,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        name: "custom1",
        description: "desc",
        config_yaml: "server:\n  listen: :8383\n",
      }),
    });

    expect(response.status).toBe(409);
    expect(await response.json()).toEqual({ error: "conflict" });
    expect(rpc).toHaveBeenCalledTimes(1);
  });

  it("returns 404 when singleton config profile RPC returns an empty array", async () => {
    rpc.mockResolvedValueOnce({
      data: [],
      error: null,
    });

    const response = await app.request("http://example.com/api/cf/gomtm/config-profiles/custom1", {
      headers: trustedDashboardHeaders,
    });

    expect(response.status).toBe(404);
    expect(await response.json()).toEqual({ error: "not found" });
  });

  it("fails loudly when singleton config profile RPC returns multiple rows", async () => {
    rpc.mockResolvedValueOnce({
      data: [{ name: "custom1" }, { name: "custom1-duplicate" }],
      error: null,
    });

    const response = await app.request("http://example.com/api/cf/gomtm/config-profiles/custom1", {
      headers: trustedDashboardHeaders,
    });

    expect(response.status).toBe(500);
    expect(await response.json()).toEqual({ error: "failed to load config profile" });
  });

  it("saves a singleton config profile from an array-shaped RPC response", async () => {
    rpc.mockResolvedValueOnce({
      data: [{ name: "custom1", description: "desc", config_yaml: "server:\n  listen: :7373\n" }],
      error: null,
    });
    rpc.mockResolvedValueOnce({
      data: [{ name: "custom1", description: "desc", config_yaml: "server:\n  listen: :8383\n" }],
      error: null,
    });

    const response = await app.request("http://example.com/api/cf/gomtm/config-profiles/custom1", {
      method: "PUT",
      headers: {
        ...trustedDashboardHeaders,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        description: "desc",
        config_yaml: "server:\n  listen: :8383\n",
      }),
    });

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      name: "custom1",
      description: "desc",
      config_yaml: "server:\n  listen: :8383\n",
    });
    expect(rpc).toHaveBeenNthCalledWith(1, "gomtm_config_profile_get", {
      p_name: "custom1",
    });
    expect(rpc).toHaveBeenNthCalledWith(2, "gomtm_config_profile_upsert", {
      p_name: "custom1",
      p_description: "desc",
      p_config_yaml: "server:\n  listen: :8383\n",
    });
  });

  it("deletes a config profile through the control-plane API", async () => {
    rpc.mockResolvedValueOnce({
      data: [{ name: "custom1", description: "desc", config_yaml: "server:\n  listen: :8383\n" }],
      error: null,
    });
    rpc.mockResolvedValueOnce({
      data: true,
      error: null,
    });

    const response = await app.request("http://example.com/api/cf/gomtm/config-profiles/custom1", {
      method: "DELETE",
      headers: trustedDashboardHeaders,
    });

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ success: true });
    expect(rpc).toHaveBeenNthCalledWith(1, "gomtm_config_profile_get", {
      p_name: "custom1",
    });
    expect(rpc).toHaveBeenNthCalledWith(2, "gomtm_config_profile_delete", {
      p_name: "custom1",
    });
  });

  it("returns 404 when deleting a missing config profile", async () => {
    rpc.mockResolvedValueOnce({
      data: [],
      error: null,
    });

    const response = await app.request("http://example.com/api/cf/gomtm/config-profiles/missing", {
      method: "DELETE",
      headers: trustedDashboardHeaders,
    });

    expect(response.status).toBe(404);
    expect(await response.json()).toEqual({ error: "not found" });
    expect(rpc).toHaveBeenCalledTimes(1);
  });

  it("returns a stable 500 when delete lookup RPC returns multiple rows", async () => {
    rpc.mockResolvedValueOnce({
      data: [{ name: "custom1" }, { name: "custom1-duplicate" }],
      error: null,
    });

    const response = await app.request("http://example.com/api/cf/gomtm/config-profiles/custom1", {
      method: "DELETE",
      headers: trustedDashboardHeaders,
    });

    expect(response.status).toBe(500);
    expect(await response.json()).toEqual({ error: "failed to delete config profile" });
    expect(rpc).toHaveBeenCalledTimes(1);
  });

  it("returns 404 when delete RPC returns a falsy payload", async () => {
    rpc.mockResolvedValueOnce({
      data: [{ name: "custom1", description: "desc", config_yaml: "server:\n  listen: :8383\n" }],
      error: null,
    });
    rpc.mockResolvedValueOnce({
      data: false,
      error: null,
    });

    const response = await app.request("http://example.com/api/cf/gomtm/config-profiles/custom1", {
      method: "DELETE",
      headers: trustedDashboardHeaders,
    });

    expect(response.status).toBe(404);
    expect(await response.json()).toEqual({ error: "not found" });
    expect(rpc).toHaveBeenNthCalledWith(1, "gomtm_config_profile_get", {
      p_name: "custom1",
    });
    expect(rpc).toHaveBeenNthCalledWith(2, "gomtm_config_profile_delete", {
      p_name: "custom1",
    });
  });

  it("preserves the stored vmess wrapper_secret when saving an existing config profile", async () => {
    rpc.mockResolvedValueOnce({
      data: [{
        name: "custom1",
        description: "desc",
        config_yaml: [
          "mproxy:",
          "  runtime:",
          "    enable: true",
          "  entries:",
          "    vmess:",
          "      enable: true",
          "      transport: ws",
          "      wrapper_secret: KEEP_ME",
          "",
        ].join("\n"),
      }],
      error: null,
    });
    rpc.mockResolvedValueOnce({
      data: [{ name: "custom1", description: "desc", config_yaml: "server:\n  listen: :8383\n" }],
      error: null,
    });

    const response = await app.request("http://example.com/api/cf/gomtm/config-profiles/custom1", {
      method: "PUT",
      headers: {
        ...trustedDashboardHeaders,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        description: "desc",
        config_yaml: [
          "mproxy:",
          "  runtime:",
          "    enable: true",
          "  entries:",
          "    vmess:",
          "      enable: true",
          "      transport: ws",
          "      wrapper_secret: DIFFERENT_SECRET",
          "",
        ].join("\n"),
      }),
    });

    expect(response.status).toBe(200);
    expect(rpc).toHaveBeenNthCalledWith(2, "gomtm_config_profile_upsert", {
      p_name: "custom1",
      p_description: "desc",
      p_config_yaml: expect.stringContaining("wrapper_secret: KEEP_ME"),
    });
  });

  it("returns 400 for malformed config yaml when saving a config profile", async () => {
    const response = await app.request("http://example.com/api/cf/gomtm/config-profiles/custom1", {
      method: "PUT",
      headers: {
        ...trustedDashboardHeaders,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        description: "desc",
        config_yaml: "mproxy:\n  entries:\n    vmess: [\n",
      }),
    });

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ error: "invalid config_yaml" });
    expect(rpc).not.toHaveBeenCalled();
  });

  it("returns 400 when saving a config profile with env placeholder vmess wrapper_secret", async () => {
    const response = await app.request("http://example.com/api/cf/gomtm/config-profiles/custom1", {
      method: "PUT",
      headers: {
        ...trustedDashboardHeaders,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        description: "desc",
        config_yaml: [
          "mproxy:",
          "  runtime:",
          "    enable: true",
          "  entries:",
          "    vmess:",
          "      enable: true",
          "      transport: ws",
          "      wrapper_secret: ${env.GOMTM_VMESS_WRAPPER_SECRET}",
          "",
        ].join("\n"),
      }),
    });

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({
      error: "mproxy.entries.vmess.wrapper_secret must be a concrete base64 value; ${env.*} placeholders are not allowed",
    });
    expect(rpc).not.toHaveBeenCalled();
  });

  it("returns a stable 500 when singleton upsert RPC returns an empty array", async () => {
    rpc.mockResolvedValueOnce({
      data: [{ name: "custom1", description: "desc", config_yaml: "server:\n  listen: :7373\n" }],
      error: null,
    });
    rpc.mockResolvedValueOnce({
      data: [],
      error: null,
    });

    const response = await app.request("http://example.com/api/cf/gomtm/config-profiles/custom1", {
      method: "PUT",
      headers: {
        ...trustedDashboardHeaders,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        description: "desc",
        config_yaml: "server:\n  listen: :8383\n",
      }),
    });

    expect(response.status).toBe(500);
    expect(await response.json()).toEqual({ error: "failed to save config profile" });
  });

  it("does not expose a publish route contract anymore", async () => {
    const response = await app.request("http://example.com/api/cf/gomtm/config-profiles/custom1/publish", {
      method: "POST",
      headers: trustedDashboardHeaders,
    });

    expect(response.status).toBe(404);
  });

  it("issues a signed runtime delivery URL without version semantics", async () => {
    rpc.mockResolvedValueOnce({
      data: [{ name: "custom1", config_yaml: "kind: worker\nname: custom1\n" }],
      error: null,
    });

    const response = await app.request("http://example.com/api/cf/gomtm/config-profiles/custom1/runtime-url", {
      method: "POST",
      headers: trustedDashboardHeaders,
    });

    expect(response.status).toBe(200);

    const body = (await response.json()) as { runtime_url: string };
    const runtimeUrl = new URL(body.runtime_url);

    expect(runtimeUrl.pathname).toBe("/api/cf/gomtm/runtime-configs/custom1");
    expect(runtimeUrl.searchParams.get("version")).toBeNull();

    const expiresAt = Number(runtimeUrl.searchParams.get("expires"));
    const signature = runtimeUrl.searchParams.get("sig") ?? "";

    expect(
      verifyRuntimeConfigSignature({
        basePath: runtimeUrl.pathname,
        expiresAt,
        signature,
        secret: "test-secret",
        now: expiresAt - 1,
      }),
    ).toBe(true);
    expect(rpc).toHaveBeenCalledWith("gomtm_runtime_config_get", {
      p_name: "custom1",
    });
  });

  it("issues a managed startup command for any saved profile without publish gating", async () => {
    rpc.mockResolvedValueOnce({
      data: [{ name: "custom1", config_yaml: "kind: worker\nname: custom1\n" }],
      error: null,
    });
    rpc.mockResolvedValueOnce({
      data: [{ credential: "gbr_demo", expires_at: "2026-04-29T03:30:00Z" }],
      error: null,
    });

    const response = await app.request("http://example.com/api/cf/gomtm/config-profiles/custom1/command", {
      method: "POST",
      headers: trustedDashboardHeaders,
    });

    expect(response.status).toBe(200);

    const body = (await response.json()) as { command: string };
    expect(body.command).toContain("gomtm server");
    expect(body.command).toContain('--bootstrap-credential="gbr_demo"');
    expect(body.command).toContain('--device-name="$(hostname)"');

    const configMatch = body.command.match(/--config="([^"]+)"/);
    expect(configMatch?.[1]).toBeTruthy();

    const runtimeUrl = new URL(configMatch?.[1] ?? "http://invalid.example");
    const expiresAt = Number(runtimeUrl.searchParams.get("expires"));
    const signature = runtimeUrl.searchParams.get("sig") ?? "";

    expect(runtimeUrl.pathname).toBe("/api/cf/gomtm/runtime-configs/custom1");
    expect(runtimeUrl.searchParams.get("version")).toBeNull();
    expect(
      verifyRuntimeConfigSignature({
        basePath: runtimeUrl.pathname,
        expiresAt,
        signature,
        secret: "test-secret",
        now: expiresAt - 1,
      }),
    ).toBe(true);
    expect(rpc).toHaveBeenNthCalledWith(1, "gomtm_runtime_config_get", {
      p_name: "custom1",
    });
    expect(rpc).toHaveBeenNthCalledWith(2, "device_bootstrap_credential_issue", {
      p_profile_name: "custom1",
      p_target_platform: "linux",
      p_device_name: "",
    });
  });

  it("returns 404 instead of issuing a bootstrap credential when no saved runtime config exists", async () => {
    rpc.mockResolvedValueOnce({
      data: null,
      error: null,
    });

    const response = await app.request("http://example.com/api/cf/gomtm/config-profiles/custom1/command", {
      method: "POST",
      headers: trustedDashboardHeaders,
    });

    expect(response.status).toBe(404);
    expect(await response.json()).toEqual({ error: "not found" });
    expect(rpc).toHaveBeenCalledTimes(1);
    expect(rpc).toHaveBeenCalledWith("gomtm_runtime_config_get", {
      p_name: "custom1",
    });
  });

  it("rejects cross-site runtime-url minting even when cookie auth exists", async () => {
    const response = await app.request("http://example.com/api/cf/gomtm/config-profiles/custom1/runtime-url", {
      method: "POST",
      headers: {
        origin: "http://evil.example",
        "sec-fetch-site": "cross-site",
      },
    });

    expect(response.status).toBe(403);
    expect(await response.json()).toEqual({ error: "forbidden" });
  });

  it("rejects cross-site startup-command minting even when cookie auth exists", async () => {
    const response = await app.request("http://example.com/api/cf/gomtm/config-profiles/custom1/command", {
      method: "POST",
      headers: {
        origin: "http://evil.example",
        "sec-fetch-site": "cross-site",
      },
    });

    expect(response.status).toBe(403);
    expect(await response.json()).toEqual({ error: "forbidden" });
    expect(rpc).not.toHaveBeenCalled();
  });

  it("rejects unsigned runtime config delivery", async () => {
    const response = await app.request("http://example.com/api/cf/gomtm/runtime-configs/custom1");

    expect(response.status).toBe(403);
    expect(await response.text()).toBe("forbidden");
  });

  it("returns a stable 500 when runtime-url current-config lookup fails", async () => {
    rpc.mockResolvedValueOnce({
      data: null,
      error: { code: "XX000", message: "database exploded: secret details" },
    });

    const response = await app.request("http://example.com/api/cf/gomtm/config-profiles/custom1/runtime-url", {
      method: "POST",
      headers: trustedDashboardHeaders,
    });

    expect(response.status).toBe(500);
    expect(await response.json()).toEqual({ error: "failed to issue runtime URL" });
  });

  it("returns a stable 500 when runtime-url current-config lookup returns multiple rows", async () => {
    rpc.mockResolvedValueOnce({
      data: [
        { config_yaml: "kind: worker\nname: custom1\n" },
        { config_yaml: "kind: worker\nname: custom1\n" },
      ],
      error: null,
    });

    const response = await app.request("http://example.com/api/cf/gomtm/config-profiles/custom1/runtime-url", {
      method: "POST",
      headers: trustedDashboardHeaders,
    });

    expect(response.status).toBe(500);
    expect(await response.json()).toEqual({ error: "failed to issue runtime URL" });
  });

  it("returns 404 when runtime-url current-config lookup finds no record", async () => {
    rpc.mockResolvedValueOnce({
      data: null,
      error: null,
    });

    const response = await app.request("http://example.com/api/cf/gomtm/config-profiles/custom1/runtime-url", {
      method: "POST",
      headers: trustedDashboardHeaders,
    });

    expect(response.status).toBe(404);
    expect(await response.json()).toEqual({ error: "not found" });
  });

  it("delivers runtime config YAML even if an irrelevant version query param is appended", async () => {
    rpc.mockResolvedValueOnce({
      data: {
        config_yaml: "kind: worker\nname: custom1\n",
      },
      error: null,
    });

    const signed = signRuntimeConfigPath({
      basePath: "/api/cf/gomtm/runtime-configs/custom1",
      expiresAt: 1_900_000_000,
      secret: "test-secret",
    });

    const response = await app.request(
      `http://example.com/api/cf/gomtm/runtime-configs/custom1?version=999&expires=${signed.expiresAt}&sig=${signed.signature}`,
    );

    expect(response.status).toBe(200);
    expect(await response.text()).toBe("kind: worker\nname: custom1\n");
  });

  it("delivers runtime config YAML with no-store when the signature is valid", async () => {
    rpc.mockResolvedValueOnce({
      data: {
        config_yaml: "kind: worker\nname: custom1\n",
      },
      error: null,
    });

    const signed = signRuntimeConfigPath({
      basePath: "/api/cf/gomtm/runtime-configs/custom1",
      expiresAt: 1_900_000_000,
      secret: "test-secret",
    });

    const response = await app.request(
      `http://example.com/api/cf/gomtm/runtime-configs/custom1?expires=${signed.expiresAt}&sig=${signed.signature}`,
    );

    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(response.headers.get("content-type")).toBe("text/yaml; charset=utf-8");
    expect(await response.text()).toBe("kind: worker\nname: custom1\n");
    expect(rpc).toHaveBeenCalledWith("gomtm_runtime_config_get", {
      p_name: "custom1",
    });
  });

  it("accepts PostgREST array-shaped runtime config responses", async () => {
    rpc.mockResolvedValueOnce({
      data: [
        {
          config_yaml: "kind: worker\nname: custom1\n",
        },
      ],
      error: null,
    });

    const signed = signRuntimeConfigPath({
      basePath: "/api/cf/gomtm/runtime-configs/custom1",
      expiresAt: 1_900_000_000,
      secret: "test-secret",
    });

    const response = await app.request(
      `http://example.com/api/cf/gomtm/runtime-configs/custom1?expires=${signed.expiresAt}&sig=${signed.signature}`,
    );

    expect(response.status).toBe(200);
    expect(await response.text()).toBe("kind: worker\nname: custom1\n");
  });

  it("returns 404 when signed runtime config does not exist", async () => {
    rpc.mockResolvedValueOnce({
      data: null,
      error: null,
    });

    const signed = signRuntimeConfigPath({
      basePath: "/api/cf/gomtm/runtime-configs/custom1",
      expiresAt: 1_900_000_000,
      secret: "test-secret",
    });

    const response = await app.request(
      `http://example.com/api/cf/gomtm/runtime-configs/custom1?expires=${signed.expiresAt}&sig=${signed.signature}`,
    );

    expect(response.status).toBe(404);
    expect(await response.text()).toBe("not found");
  });

  it("hides runtime config backend failures behind a stable 500 response", async () => {
    rpc.mockResolvedValueOnce({
      data: null,
      error: { code: "XX000", message: "database exploded: secret details" },
    });

    const signed = signRuntimeConfigPath({
      basePath: "/api/cf/gomtm/runtime-configs/custom1",
      expiresAt: 1_900_000_000,
      secret: "test-secret",
    });

    const response = await app.request(
      `http://example.com/api/cf/gomtm/runtime-configs/custom1?expires=${signed.expiresAt}&sig=${signed.signature}`,
    );

    expect(response.status).toBe(500);
    expect(await response.text()).toBe("runtime config unavailable");
  });
});
