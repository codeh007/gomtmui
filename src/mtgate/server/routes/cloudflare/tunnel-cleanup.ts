import { zValidator } from "@hono/zod-validator";
import { Hono } from "hono";
import { z } from "zod";
import type { AppContext } from "../../../types";
import { getCfClient } from "../../lib/cloudflare/cloudflare";
import { cleanupDnsRecords, getTunnelName } from "../../lib/cloudflare/tunnel-utils";

export const tunnelCleanupRoute = new Hono<AppContext>();

const TunnelCleanupInputSchema = z.object({
  worker_id: z.string().min(1),

  // Cloudflare Credentials
  cloudflare: z.object({
    account_id: z.string().min(1),
    api_token: z.string().min(1),
    zone_id: z.string().optional(),
  }),

  // Tunnel Config
  tunnel: z.object({
    prefix: z.string().default(""),
    domain: z.string().min(1),
  }),
});

tunnelCleanupRoute.post("/cleanup", zValidator("json", TunnelCleanupInputSchema), async (c) => {
  const { worker_id, cloudflare, tunnel } = c.req.valid("json");

  try {
    const client = getCfClient(cloudflare.api_token);
    const accountId = cloudflare.account_id;
    const tunnelName = getTunnelName(tunnel.prefix, worker_id);

    // 1. Find Tunnel
    const tunnels = await client.zeroTrust.tunnels.list({
      account_id: accountId,
      name: tunnelName,
      is_deleted: false,
    });

    if (tunnels.result.length === 0) {
      return c.json({ success: true, message: "Tunnel not found" });
    }

    const tunnelId = tunnels.result[0]?.id;
    if (!tunnelId) {
      return c.json({ success: false, error: "Tunnel ID is undefined" }, 500);
    }

    // 2. Clean up DNS records
    if (cloudflare.zone_id) {
      try {
        await cleanupDnsRecords(client, cloudflare.zone_id, tunnelId);
      } catch (e) {
        console.warn("[tunnel-cleanup] DNS cleanup warning:", e);
      }
    }

    // 3. Delete Tunnel
    await client.zeroTrust.tunnels.cloudflared.delete(tunnelId, {
      account_id: accountId,
    });
    console.log(`[tunnel-cleanup] Deleted tunnel: ${tunnelName} (${tunnelId})`);

    return c.json({ success: true, tunnel_id: tunnelId });
  } catch (e: unknown) {
    console.error("[tunnel-cleanup] Error:", e);
    const errorMessage = e instanceof Error ? e.message : String(e);
    return c.json({ success: false, error: errorMessage }, 500);
  }
});
