import { zValidator } from "@hono/zod-validator";
import { Hono } from "hono";
import { getSupabase } from "mtmsdk/supabase/supabase";
import { z } from "zod";
import { PLATFORM_CONFIGS, type PlatformName } from "@/lib/cloud-account/platform-configs";
import type { AppContext } from "../../../types";

export const tokenRefreshRoute = new Hono<AppContext>();

const refreshSchema = z.object({
  accountId: z.uuid(),
  autoUpdate: z.boolean().optional().default(false),
});

tokenRefreshRoute.post("/token/refresh", zValidator("json", refreshSchema), async (c) => {
  const { accountId, autoUpdate } = c.req.valid("json");
  const sb = getSupabase(c);

  // 1. Get account from DB
  const { data: account, error: getErr } = await sb.rpc("cloud_account_get", { p_id: accountId }).single();

  if (getErr || !account) {
    console.error(`[token-refresh] Account ${accountId} not found or access denied:`, getErr);
    return c.json({ error: "Account not found or access denied" }, 404);
  }

  const platformName = account.platform_name as PlatformName;
  const platformConfig = PLATFORM_CONFIGS[platformName];

  const oauthConfig = (platformConfig as any).oauth;
  if (!oauthConfig) {
    return c.json({ error: `Platform ${platformName} not supported for OAuth refresh` }, 400);
  }

  const { data: sensitiveData, error: sensitiveErr } = await sb
    .from("cloud_accounts")
    .select("refresh_token")
    .eq("id", accountId)
    .single();

  if (sensitiveErr || !sensitiveData?.refresh_token) {
    return c.json({ error: "No refresh token available or access denied" }, 400);
  }

  const refreshToken = sensitiveData.refresh_token;

  // 3. Prepare refresh request
  const tokenUrl = oauthConfig.tokenUrl;

  const envPrefix = platformName.toUpperCase();
  const clientId = c.env[`${envPrefix}_CLIENT_ID`] || oauthConfig.clientId;
  const clientSecret = c.env[`${envPrefix}_CLIENT_SECRET`];

  if (!clientId) {
    return c.json({ error: `Missing client_id for platform ${platformName}` }, 500);
  }

  const body = new URLSearchParams({
    grant_type: "refresh_token",
    refresh_token: refreshToken,
    client_id: clientId,
  });

  if (clientSecret) {
    body.append("client_secret", clientSecret);
  }

  console.log(`[token-refresh] Refreshing token for ${platformName} (${accountId}) at ${tokenUrl}`);

  try {
    const response = await fetch(tokenUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        Accept: "application/json",
      },
      body: body.toString(),
    });

    const tokenData = (await response.json()) as any;

    if (!response.ok) {
      console.error(`[token-refresh] Failed to refresh token for ${platformName}:`, tokenData);

      if (autoUpdate) {
        // Automatically mark as failed in DB
        await sb.rpc("cloud_account_mark_refresh_failed", {
          p_id: accountId,
          p_error: tokenData.error || tokenData.message || "Unknown platform error",
        });
      }

      return c.json(
        {
          error: "Failed to refresh token from platform",
          details: tokenData,
          status: response.status,
        },
        502,
      );
    }

    if (autoUpdate) {
      if (!tokenData.refresh_token) {
        return c.json({ error: "Platform refresh response missing refresh_token" }, 502);
      }

      // Automatically update DB
      const { error: updateErr } = await sb.rpc("cloud_account_refresh_token", {
        p_id: accountId,
        p_access_token: tokenData.access_token,
        p_refresh_token: tokenData.refresh_token,
        p_expires_in: tokenData.expires_in,
      });

      if (updateErr) {
        console.error(`[token-refresh] Failed to update DB after refresh:`, updateErr);
        return c.json({ error: "Token refreshed but failed to update database", details: updateErr }, 500);
      }
    }

    return c.json(tokenData);
  } catch (err: any) {
    console.error(`[token-refresh] Unexpected error during refresh:`, err);
    return c.json({ error: "Internal server error during token refresh", details: err.message }, 500);
  }
});
