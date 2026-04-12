import { zValidator } from "@hono/zod-validator";
import { Hono } from "hono";
import { z } from "zod";
import type { AppContext } from "../../../types";
import { getCfClient } from "../../lib/cloudflare/cloudflare";
import { ensureDnsRecord, getHost, getTunnelName } from "../../lib/cloudflare/tunnel-utils";

export const tunnelSetupRoute = new Hono<AppContext>();

// ========================================
// 完整输入 Schema (包含凭据)
// ========================================
const TunnelSetupInputSchema = z.object({
  worker_id: z.string().min(1),

  // Cloudflare 凭据 - 从请求获取，不用环境变量
  cloudflare: z.object({
    account_id: z.string().min(1),
    api_token: z.string().min(1),
    zone_id: z.string().optional(),
  }),

  // Tunnel 配置
  tunnel: z.object({
    prefix: z.string().default(""),
    domain: z.string().min(1),
  }),

  // 服务列表
  services: z
    .array(
      z.object({
        type: z.string(),
        local_port: z.number(),
      }),
    )
    .default([
      { type: "main", local_port: 8383 },
      { type: "vnc", local_port: 8444 },
      { type: "browser", local_port: 8848 },
    ]),
});

tunnelSetupRoute.post("/setup", zValidator("json", TunnelSetupInputSchema), async (c) => {
  const { worker_id, cloudflare, tunnel, services } = c.req.valid("json");

  try {
    // 1. 使用工厂函数初始化 Cloudflare Client
    const client = getCfClient(cloudflare.api_token);
    const accountId = cloudflare.account_id;

    // 2. 生成 Tunnel 名称
    const tunnelName = getTunnelName(tunnel.prefix, worker_id);

    // 3. 查找或创建 Tunnel
    const tunnels = await client.zeroTrust.tunnels.list({
      account_id: accountId,
      name: tunnelName,
      is_deleted: false,
    });

    let tunnelId: string | undefined;
    if (tunnels.result.length > 0) {
      tunnelId = tunnels.result[0].id;
    } else {
      const newTunnel = await client.zeroTrust.tunnels.cloudflared.create({
        account_id: accountId,
        name: tunnelName,
        tunnel_secret: crypto.randomUUID().replace(/-/g, ""),
      });
      tunnelId = newTunnel.id;
    }

    if (!tunnelId) {
      throw new Error("Failed to retrieve or create tunnel ID");
    }

    // 4. 配置 Ingress Rules
    const ingress = [
      ...services.map((s) => ({
        hostname: getHost(tunnelName, tunnel.domain, s.type),
        service: `http://127.0.0.1:${s.local_port}`,
      })),
      { hostname: "", service: "http_status:404" },
    ];

    await client.zeroTrust.tunnels.cloudflared.configurations.update(tunnelId, {
      account_id: accountId,
      config: { ingress },
    });

    // 5. 配置 DNS (尽力而为)
    const dns_results: any[] = [];
    if (cloudflare.zone_id) {
      for (const s of services) {
        const hostname = getHost(tunnelName, tunnel.domain, s.type);
        try {
          await ensureDnsRecord(client, cloudflare.zone_id, tunnelId, hostname);
          dns_results.push({ type: s.type, success: true });
        } catch (e: any) {
          console.warn(`[tunnel-setup] DNS error for ${s.type}:`, e.message);
          dns_results.push({
            type: s.type,
            success: false,
            error: e.message,
            code: e.errors?.[0]?.code,
          });
        }
      }
    }

    // 6. 获取 Token
    const tokenResp = await client.zeroTrust.tunnels.cloudflared.token.get(tunnelId, {
      account_id: accountId,
    });

    // 7. 返回结果
    return c.json({
      success: true,
      token: tokenResp,
      tunnel_id: tunnelId,
      tunnel_name: tunnelName,
      dns_results,
      public_domains: services.map((s) => ({
        type: s.type,
        domain: getHost(tunnelName, tunnel.domain, s.type),
      })),
    });
  } catch (e: any) {
    console.error("[tunnel-setup] Error:", e);
    return c.json(
      {
        success: false,
        error: e.message,
      },
      500,
    );
  }
});
