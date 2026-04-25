import { zValidator } from "@hono/zod-validator";
import { Hono } from "hono";
import { getSupabase, getSupabaseAdmin } from "mtmsdk/supabase/supabase";
import { z } from "zod";
import { getCfClient } from "../../lib/cloudflare/cloudflare";
import { ensureDnsRecord } from "../../lib/cloudflare/tunnel-utils";
import { getServerBaseUrl } from "../../lib/sslib";
import type { AppContext } from "../../types";
import {
    buildWindowsBootstrapScript,
    buildWindowsManualBootstrapCommand,
    buildWindowsP2PWsHostname,
    buildWindowsTunnelIngress,
    createWindowsBootstrapToken,
    resolveInstallBaseUrl,
    resolveWindowsP2PWsHostname,
    verifyWindowsBootstrapToken,
} from "./windows-bootstrap-utils";

const cloudflareConfigSchema = z.object({
  account_id: z.string().min(1),
  api_token: z.string().min(1),
  zone_id: z.string().min(1),
});

const domainConfigSchema = z.object({
  primary_domain: z.string().min(1),
  worker_subdomain_prefix: z.string().default(""),
});

const siteUrlSchema = z.string().url();

const tunnelConfigSchema = z.object({
  token: z.string().min(1),
  tunnel_id: z.string().min(1),
  tunnel_name: z.string().min(1),
  hostname: z.string().min(1),
  p2p_ws_hostname: z.string().min(1).optional(),
});

const serverConfigSchema = z.object({
  bootstrap_mode: z.string().optional(),
  platform: z.string().optional(),
  tunnel: tunnelConfigSchema,
});

const manualBootstrapRequestSchema = z.object({
  serverId: z.uuid().optional(),
});

const installScriptQuerySchema = z.object({
  token: z.string().min(1),
});

const tokenTTLMS = 15 * 60 * 1000;

function readTunnelToken(value: unknown) {
  if (typeof value === "string") {
    return value;
  }
  if (value && typeof value === "object") {
    const token = (value as { token?: unknown }).token;
    if (typeof token === "string") {
      return token;
    }
  }
  return "";
}

export const windowsBootstrapRoute = new Hono<AppContext>();

windowsBootstrapRoute.post("/manual-bootstrap", zValidator("json", manualBootstrapRequestSchema), async (c) => {
  const sb = getSupabase(c);
  const sbAdmin = getSupabaseAdmin();
  const { serverId } = c.req.valid("json");
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();

  if (!serviceRoleKey) {
    return c.json({ error: "服务端缺少 SUPABASE_SERVICE_ROLE_KEY，无法生成 Windows 启动命令" }, 500);
  }

  const { data: canManage, error: permissionError } = await sb.rpc("has_permission", {
    p_resource: "servers",
    p_action: "manage",
  });

  if (permissionError || !canManage) {
    return c.json({ error: "需要管理员权限才能生成 Windows 启动命令" }, 403);
  }

  try {
    const domainConfigResult = await sbAdmin.rpc("system_config_public_get", { p_key: "domain_config" });
    const domainConfig = domainConfigSchema.safeParse(domainConfigResult.data);
    if (!domainConfig.success) {
      return c.json({ error: "缺少公网域名配置，请先在系统设置中配置 domain_config" }, 400);
    }

    const siteUrlResult = await sbAdmin.rpc("system_config_public_get", { p_key: "site_url" });
    const siteUrl = siteUrlSchema.safeParse(siteUrlResult.data).success
      ? siteUrlSchema.parse(siteUrlResult.data)
      : undefined;

    const cloudflareConfigResult = await sbAdmin.rpc("sys_config_get", { p_key: "cloudflare_config" });
    const cloudflareConfig = cloudflareConfigSchema.safeParse(cloudflareConfigResult.data);
    if (!cloudflareConfig.success) {
      return c.json({ error: "缺少 Cloudflare 配置，请先在系统设置中配置 cloudflare_config" }, 400);
    }

    const resolvedServerId = serverId ?? crypto.randomUUID();
    const installURL = new URL(
      "/api/cf/server/windows/install.ps1",
      resolveInstallBaseUrl(c.req.url, siteUrl, getServerBaseUrl()),
    );
    const publicDomain = domainConfig.data.primary_domain.trim();

    let tunnelConfig: z.infer<typeof tunnelConfigSchema>;
    if (serverId) {
      const existingServer = await sbAdmin.from("servers").select("id, config").eq("id", serverId).single();
      if (existingServer.error || !existingServer.data) {
        return c.json({ error: `实例不存在: ${serverId}` }, 404);
      }

      const existingConfig = serverConfigSchema.safeParse(existingServer.data.config ?? {});
      if (!existingConfig.success) {
        return c.json({ error: "目标实例缺少 Windows 手动引导配置" }, 400);
      }
      if (existingConfig.data.bootstrap_mode !== "windows_manual" || existingConfig.data.platform !== "windows") {
        return c.json({ error: "目标实例不是 Windows 手动引导实例" }, 400);
      }

      tunnelConfig = existingConfig.data.tunnel;
      const p2pWsHostname = resolveWindowsP2PWsHostname(
        tunnelConfig.tunnel_name,
        tunnelConfig.hostname,
        tunnelConfig.p2p_ws_hostname,
      );
      if (p2pWsHostname !== tunnelConfig.p2p_ws_hostname) {
        const client = getCfClient(cloudflareConfig.data.api_token);
        await client.zeroTrust.tunnels.cloudflared.configurations.update(tunnelConfig.tunnel_id, {
          account_id: cloudflareConfig.data.account_id,
          config: {
            ingress: buildWindowsTunnelIngress(tunnelConfig.hostname, p2pWsHostname),
          },
        });
        await ensureDnsRecord(client, cloudflareConfig.data.zone_id, tunnelConfig.tunnel_id, p2pWsHostname);

        tunnelConfig = {
          ...tunnelConfig,
          p2p_ws_hostname: p2pWsHostname,
        };

        const updatedConfig = {
          ...existingConfig.data,
          tunnel: {
            ...existingConfig.data.tunnel,
            p2p_ws_hostname: p2pWsHostname,
          },
        };
        const updateResult = await sbAdmin.from("servers").update({ config: updatedConfig }).eq("id", serverId);
        if (updateResult.error) {
          throw updateResult.error;
        }
      }
    } else {
      const tunnelName = `${domainConfig.data.worker_subdomain_prefix}${resolvedServerId.slice(-6)}`;
      const hostname = `${tunnelName}.${publicDomain}`;
      const p2pWsHostname = buildWindowsP2PWsHostname(tunnelName, publicDomain);
      const client = getCfClient(cloudflareConfig.data.api_token);
      const createdTunnel = await client.zeroTrust.tunnels.cloudflared.create({
        account_id: cloudflareConfig.data.account_id,
        name: tunnelName,
        tunnel_secret: crypto.randomUUID().replaceAll("-", ""),
      });
      const tunnelID = createdTunnel.id?.trim();
      if (!tunnelID) {
        throw new Error("Cloudflare tunnel 创建成功但未返回 tunnel id");
      }

      await client.zeroTrust.tunnels.cloudflared.configurations.update(tunnelID, {
        account_id: cloudflareConfig.data.account_id,
        config: {
          ingress: buildWindowsTunnelIngress(hostname, p2pWsHostname),
        },
      });

      await ensureDnsRecord(client, cloudflareConfig.data.zone_id, tunnelID, hostname);
      await ensureDnsRecord(client, cloudflareConfig.data.zone_id, tunnelID, p2pWsHostname);

      const tokenResponse = await client.zeroTrust.tunnels.cloudflared.token.get(tunnelID, {
        account_id: cloudflareConfig.data.account_id,
      });
      const rawToken = readTunnelToken(tokenResponse);

      if (!rawToken) {
        throw new Error("Cloudflare tunnel token 为空");
      }

      tunnelConfig = {
        token: rawToken,
        tunnel_id: tunnelID,
        tunnel_name: tunnelName,
        hostname,
        p2p_ws_hostname: p2pWsHostname,
      };

      const insertResult = await sbAdmin.from("servers").insert({
        id: resolvedServerId,
        config: {
          platform: "windows",
          bootstrap_mode: "windows_manual",
          tunnel: {
            ...tunnelConfig,
          },
        },
        state: {
          status: "bootstrapping",
          status_source: "windows_manual_bootstrap",
          bootstrap_started_at: new Date().toISOString(),
          platform: "windows",
          bootstrap_mode: "windows_manual",
        },
      });

      if (insertResult.error) {
        await client.zeroTrust.tunnels.cloudflared.delete(tunnelID, {
          account_id: cloudflareConfig.data.account_id,
        });
        throw insertResult.error;
      }
    }

    const token = await createWindowsBootstrapToken(
      {
        serverId: resolvedServerId,
        exp: Date.now() + tokenTTLMS,
      },
      serviceRoleKey,
    );
    installURL.searchParams.set("token", token);

    return c.json({
      id: resolvedServerId,
      hostname: tunnelConfig.hostname,
      public_url: `https://${tunnelConfig.hostname}`,
      install_url: installURL.toString(),
      command: buildWindowsManualBootstrapCommand(installURL.toString()),
      expires_at: new Date(Date.now() + tokenTTLMS).toISOString(),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return c.json({ error: `生成 Windows 启动命令失败: ${message}` }, 500);
  }
});

windowsBootstrapRoute.get("/install.ps1", zValidator("query", installScriptQuerySchema), async (c) => {
  const sbAdmin = getSupabaseAdmin();
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  const supabaseURL = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim();

  if (!serviceRoleKey || !supabaseURL || !supabaseAnonKey) {
    return c.text("# missing required supabase environment", 500, {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "no-store",
    });
  }

  try {
    const { token } = c.req.valid("query");
    const payload = await verifyWindowsBootstrapToken(token, serviceRoleKey);

    const serverResult = await sbAdmin.from("servers").select("id, config").eq("id", payload.serverId).single();
    if (serverResult.error || !serverResult.data) {
      return c.text("# server not found", 404, {
        "Content-Type": "text/plain; charset=utf-8",
        "Cache-Control": "no-store",
      });
    }

    const serverConfig = serverConfigSchema.parse(serverResult.data.config ?? {});
    if (serverConfig.bootstrap_mode !== "windows_manual" || serverConfig.platform !== "windows") {
      return c.text("# invalid bootstrap target", 400, {
        "Content-Type": "text/plain; charset=utf-8",
        "Cache-Control": "no-store",
      });
    }

    const script = buildWindowsBootstrapScript({
      hostname: serverConfig.tunnel.hostname,
      p2pWsHostname: resolveWindowsP2PWsHostname(
        serverConfig.tunnel.tunnel_name,
        serverConfig.tunnel.hostname,
        serverConfig.tunnel.p2p_ws_hostname,
      ),
      publicUrl: `https://${serverConfig.tunnel.hostname}`,
      instanceId: payload.serverId,
      cloudflaredToken: serverConfig.tunnel.token,
      supabaseUrl: supabaseURL,
      supabaseAnonKey: supabaseAnonKey,
      supabaseServiceRoleKey: serviceRoleKey,
      gomtmBinaryUrls: [
        "https://unpkg.com/gomtm-win@latest/bin/gomtm.exe",
        "https://cdn.jsdelivr.net/npm/gomtm-win@latest/bin/gomtm.exe",
      ],
    });

    return c.text(script, 200, {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "no-store",
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return c.text(`# ${message}`, 403, {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "no-store",
    });
  }
});
