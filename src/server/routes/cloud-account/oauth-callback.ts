import { PLATFORM_CONFIGS, type PlatformConfig, type PlatformName } from "@/lib/cloud-account/platform-configs";
import { zValidator } from "@hono/zod-validator";
import { Hono } from "hono";
import { z } from "zod";
import type { AppContext } from "../../types";

export const oauthCallbackRoute = new Hono<AppContext>();

const exchangeSchema = z.object({
  platformName: z.string(),
  code: z.string(),
  codeVerifier: z.string().optional(),
  redirectUri: z.string(),
});

/**
 * Exchange authorization code for access token.
 * This is called by the frontend after receiving a code from the OAuth provider.
 */
oauthCallbackRoute.post("/oauth/exchange", zValidator("json", exchangeSchema), async (c) => {
  const { platformName, code, codeVerifier, redirectUri } = c.req.valid("json");

  const platformConfig = PLATFORM_CONFIGS[platformName as PlatformName] as PlatformConfig;
  if (!platformConfig || !platformConfig.oauth) {
    return c.json({ error: `Platform ${platformName} not found or doesn't support OAuth` }, 400);
  }

  const oauthConfig = platformConfig.oauth;
  const envPrefix = platformName.toUpperCase();
  const clientId = c.env[`${envPrefix}_CLIENT_ID`] || oauthConfig.clientId;
  const clientSecret = c.env[`${envPrefix}_CLIENT_SECRET`];

  if (!clientId) {
    return c.json({ error: `Missing client_id for platform ${platformName}` }, 500);
  }

  const body = new URLSearchParams({
    grant_type: "authorization_code",
    code,
    redirect_uri: redirectUri,
    client_id: clientId,
  });

  if (clientSecret) {
    body.append("client_secret", clientSecret);
  }

  if (codeVerifier) {
    body.append("code_verifier", codeVerifier);
  }

  console.log(`[oauth-exchange] Exchanging code for ${platformName} at ${oauthConfig.tokenUrl}`);

  try {
    const response = await fetch(oauthConfig.tokenUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        Accept: "application/json",
      },
      body: body.toString(),
    });

    const tokenData = (await response.json()) as Record<string, any>;

    if (!response.ok) {
      console.error(`[oauth-exchange] Failed to exchange code for ${platformName}:`, tokenData);
      return c.json(
        {
          error: "Failed to exchange code from platform",
          details: tokenData,
          status: response.status,
        },
        502,
      );
    }

    return c.json(tokenData);
  } catch (err: any) {
    console.error(`[oauth-exchange] Unexpected error during exchange:`, err);
    return c.json({ error: "Internal server error during token exchange", details: err.message }, 500);
  }
});
