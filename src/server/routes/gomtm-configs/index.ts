import { ApiPrefix } from "@/server/context";
import { GomtmConfigDocumentSchema, type GomtmConfigDocument } from "@/components/gomtm-configs/config-schema";
import { zValidator } from "@hono/zod-validator";
import type { Context } from "hono";
import { Hono } from "hono";
import { getSupabase } from "mtmsdk/supabase/supabase";
import { z } from "zod";
import type { AppContext } from "../../types";
import {
  GOMTM_RUNTIME_CONFIG_SIGNING_SECRET_ENV,
  signRuntimeConfigPath,
  verifyRuntimeConfigSignature,
} from "./signing";
import { buildManagedLinuxStartupCommand } from "./command";

export const gomtmConfigsRoute = new Hono<AppContext>();

const RUNTIME_URL_TTL_SECONDS = 60 * 60;
const MANAGED_LINUX_TARGET_PLATFORM = "linux";
const DEFAULT_DEVICE_NAME_EXPRESSION = "$(hostname)";
const runtimeConfigHeaders = {
  "cache-control": "no-store",
  "content-type": "application/json; charset=utf-8",
};

const upsertProfileSchema = z.object({
  description: z.string().optional().default(""),
  config_document: GomtmConfigDocumentSchema,
});

const createProfileSchema = upsertProfileSchema.extend({
  name: z.string().min(1, "name is required"),
});

type RpcErrorLike = {
  code?: string | null;
  details?: string | null;
  hint?: string | null;
  message: string;
};

type GomtmConfigProfileRecord = {
  config_document?: GomtmConfigDocument | null;
  description?: string | null;
  id?: string | null;
  name?: string;
  created_at?: string | null;
  updated_at?: string | null;
};

type GomtmRuntimeConfigRecord = {
  config_document?: GomtmConfigDocument | null;
  name?: string | null;
};

type DeviceBootstrapCredentialRecord = {
  credential?: string | null;
  expires_at?: string | null;
};

type GomtmConfigSupabase = {
  auth: {
    getUser: () => Promise<{
      data: { user: { id?: string } | null };
      error: RpcErrorLike | null;
    }>;
  };
  rpc: <TData>(functionName: string, args?: Record<string, unknown>) => Promise<{
    data: TData;
    error: RpcErrorLike | null;
  }>;
};

gomtmConfigsRoute.get("/config-profiles", async (c) => {
  const trustedResponse = requireTrustedControlPlaneRequest(c);
  if (trustedResponse) {
    return trustedResponse;
  }

  const auth = await getAuthenticatedSupabase(c);
  if (auth.response) {
    return auth.response;
  }

  const { data, error } = await auth.supabase.rpc<GomtmConfigProfileRecord[]>("gomtm_config_profile_list_cursor", {
    p_limit: 200,
    p_offset: 0,
  });
  if (error) {
    return createControlPlaneRpcErrorResponse(c, error, "failed to list config profiles");
  }

  return c.json({ items: data ?? [] });
});

gomtmConfigsRoute.get("/config-profiles/:name", async (c) => {
  const trustedResponse = requireTrustedControlPlaneRequest(c);
  if (trustedResponse) {
    return trustedResponse;
  }

  const auth = await getAuthenticatedSupabase(c);
  if (auth.response) {
    return auth.response;
  }

  const { data, error } = await auth.supabase.rpc<GomtmConfigProfileRecord[] | GomtmConfigProfileRecord | null>("gomtm_config_profile_get", {
    p_name: c.req.param("name"),
  });
  if (error) {
    return createControlPlaneRpcErrorResponse(c, error, "failed to load config profile");
  }
  const profile = normalizeSingletonRpcRow(data);
  if (profile.multiple) {
    return c.json({ error: "failed to load config profile" }, 500);
  }
  if (!profile.record) {
    return c.json({ error: "not found" }, 404);
  }

  return c.json(profile.record);
});

gomtmConfigsRoute.post("/config-profiles", zValidator("json", createProfileSchema), async (c) => {
  const trustedResponse = requireTrustedControlPlaneRequest(c);
  if (trustedResponse) {
    return trustedResponse;
  }

	const auth = await getAuthenticatedSupabase(c);
	if (auth.response) {
		return auth.response;
	}

	const body = c.req.valid("json");
	const existingProfile = await auth.supabase.rpc<GomtmConfigProfileRecord[] | GomtmConfigProfileRecord | null>("gomtm_config_profile_get", {
		p_name: body.name,
	});
	if (existingProfile.error) {
		return createControlPlaneRpcErrorResponse(c, existingProfile.error, "failed to create config profile");
	}
	const existing = normalizeSingletonRpcRow(existingProfile.data);
	if (existing.multiple) {
		return c.json({ error: "failed to create config profile" }, 500);
	}
	if (existing.record) {
		return c.json({ error: "conflict" }, 409);
	}
	const { data, error } = await auth.supabase.rpc<GomtmConfigProfileRecord[] | GomtmConfigProfileRecord | null>("gomtm_config_profile_upsert", {
		p_name: body.name,
		p_description: body.description,
    p_config_document: body.config_document,
  });
  if (error) {
    return createControlPlaneRpcErrorResponse(c, error, "failed to create config profile");
  }
  const profile = normalizeSingletonRpcRow(data);
  if (profile.multiple) {
    return c.json({ error: "failed to create config profile" }, 500);
  }
  if (!profile.record) {
    return c.json({ error: "failed to create config profile" }, 500);
  }

  return c.json(profile.record);
});

gomtmConfigsRoute.put("/config-profiles/:name", zValidator("json", upsertProfileSchema), async (c) => {
  const trustedResponse = requireTrustedControlPlaneRequest(c);
  if (trustedResponse) {
    return trustedResponse;
  }

  const auth = await getAuthenticatedSupabase(c);
  if (auth.response) {
    return auth.response;
  }

  const body = c.req.valid("json");
  const currentProfile = await auth.supabase.rpc<GomtmConfigProfileRecord[] | GomtmConfigProfileRecord | null>("gomtm_config_profile_get", {
    p_name: c.req.param("name"),
  });
  if (currentProfile.error) {
    return createControlPlaneRpcErrorResponse(c, currentProfile.error, "failed to save config profile");
  }
  const existingProfile = normalizeSingletonRpcRow(currentProfile.data);
  if (existingProfile.multiple) {
    return c.json({ error: "failed to save config profile" }, 500);
  }
  if (!existingProfile.record) {
    return c.json({ error: "not found" }, 404);
  }
  const { data, error } = await auth.supabase.rpc<GomtmConfigProfileRecord[] | GomtmConfigProfileRecord | null>("gomtm_config_profile_upsert", {
    p_name: c.req.param("name"),
    p_description: body.description,
    p_config_document: body.config_document,
  });
  if (error) {
    return createControlPlaneRpcErrorResponse(c, error, "failed to save config profile");
  }
  const profile = normalizeSingletonRpcRow(data);
  if (profile.multiple) {
    return c.json({ error: "failed to save config profile" }, 500);
  }
  if (!profile.record) {
    return c.json({ error: "failed to save config profile" }, 500);
  }

  return c.json(profile.record);
});

gomtmConfigsRoute.delete("/config-profiles/:name", async (c) => {
  const trustedResponse = requireTrustedControlPlaneRequest(c);
  if (trustedResponse) {
    return trustedResponse;
  }

  const auth = await getAuthenticatedSupabase(c);
  if (auth.response) {
    return auth.response;
  }

  const profileName = c.req.param("name");
  const currentProfile = await auth.supabase.rpc<GomtmConfigProfileRecord[] | GomtmConfigProfileRecord | null>("gomtm_config_profile_get", {
    p_name: profileName,
  });
  if (currentProfile.error) {
    return createControlPlaneRpcErrorResponse(c, currentProfile.error, "failed to delete config profile");
  }

  const existingProfile = normalizeSingletonRpcRow(currentProfile.data);
  if (existingProfile.multiple) {
    return c.json({ error: "failed to delete config profile" }, 500);
  }
  if (!existingProfile.record) {
    return c.json({ error: "not found" }, 404);
  }

  const { data, error } = await auth.supabase.rpc<boolean>("gomtm_config_profile_delete", {
    p_name: profileName,
  });
  if (error) {
    return createControlPlaneRpcErrorResponse(c, error, "failed to delete config profile");
  }

  if (!data) {
    return c.json({ error: "not found" }, 404);
  }

  return c.json({ success: true });
});

gomtmConfigsRoute.post("/config-profiles/:name/runtime-url", async (c) => {
  const trustedResponse = requireTrustedControlPlaneRequest(c);
  if (trustedResponse) {
    return trustedResponse;
  }

  const auth = await getAuthenticatedSupabase(c);
  if (auth.response) {
    return auth.response;
  }

  const secret = getRuntimeConfigSigningSecret(c);
  if (!secret) {
    return c.json({ error: "missing signing secret" }, 500);
  }

  const profileName = c.req.param("name");
  const runtimeConfig = await getCurrentRuntimeConfig(auth.supabase, profileName);
  if (runtimeConfig.error) {
    return createControlPlaneRpcErrorResponse(c, runtimeConfig.error, "failed to issue runtime URL");
  }
  if (runtimeConfig.multiple) {
    return c.json({ error: "failed to issue runtime URL" }, 500);
  }
  if (!runtimeConfig.record) {
    return c.json({ error: "not found" }, 404);
  }

  return c.json({
    runtime_url: buildSignedRuntimeConfigUrl(c, profileName, secret),
  });
});

gomtmConfigsRoute.post("/config-profiles/:name/command", async (c) => {
  const trustedResponse = requireTrustedControlPlaneRequest(c);
  if (trustedResponse) {
    return trustedResponse;
  }

  const auth = await getAuthenticatedSupabase(c);
  if (auth.response) {
    return auth.response;
  }

  const secret = getRuntimeConfigSigningSecret(c);
  if (!secret) {
    return c.json({ error: "missing signing secret" }, 500);
  }

  const profileName = c.req.param("name");
  const runtimeConfig = await getCurrentRuntimeConfig(auth.supabase, profileName);
  if (runtimeConfig.error) {
    return createControlPlaneRpcErrorResponse(c, runtimeConfig.error, "failed to issue startup command");
  }
  if (runtimeConfig.multiple) {
    return c.json({ error: "failed to issue startup command" }, 500);
  }
  if (!runtimeConfig.record) {
    return c.json({ error: "not found" }, 404);
  }

  const { data, error } = await auth.supabase.rpc<DeviceBootstrapCredentialRecord[] | DeviceBootstrapCredentialRecord | null>(
    "device_bootstrap_credential_issue",
    {
      p_profile_name: profileName,
      p_target_platform: MANAGED_LINUX_TARGET_PLATFORM,
      p_device_name: "",
    },
  );
  if (error) {
    return createControlPlaneRpcErrorResponse(c, error, "failed to issue startup command");
  }

  const bootstrapCredential = normalizeSingletonRpcRow(data);
  if (bootstrapCredential.multiple) {
    return c.json({ error: "failed to issue startup command" }, 500);
  }
  if (!bootstrapCredential.record?.credential) {
    return c.json({ error: "failed to issue startup command" }, 500);
  }

  return c.json({
    command: buildManagedLinuxStartupCommand({
      configUrl: buildSignedRuntimeConfigUrl(c, profileName, secret),
      bootstrapCredential: bootstrapCredential.record.credential,
      deviceNameExpression: DEFAULT_DEVICE_NAME_EXPRESSION,
    }),
  });
});

gomtmConfigsRoute.get("/runtime-configs/:name", async (c) => {
  const secret = getRuntimeConfigSigningSecret(c);
  if (!secret) {
    return c.text("runtime config unavailable", 500);
  }

  const expiresAt = Number(c.req.query("expires") ?? "0");
  const signature = c.req.query("sig") ?? "";
  const basePath = new URL(c.req.url).pathname;

  if (
    !Number.isFinite(expiresAt) ||
    !verifyRuntimeConfigSignature({
      basePath,
      expiresAt,
      signature,
      secret,
      now: Math.floor(Date.now() / 1000),
    })
  ) {
    return c.text("forbidden", 403);
  }

  const supabase = getGomtmConfigSupabase(c);
  const runtimeConfig = await getCurrentRuntimeConfig(supabase, c.req.param("name"));
  if (runtimeConfig.error) {
    return createRuntimeConfigErrorResponse(c, runtimeConfig.error);
  }
  if (runtimeConfig.multiple) {
    return c.text("runtime config unavailable", 500);
  }
  if (!runtimeConfig.record) {
    return c.text("not found", 404);
  }

  return new Response(JSON.stringify(runtimeConfig.record.config_document), {
    status: 200,
    headers: runtimeConfigHeaders,
  });
});

async function getAuthenticatedSupabase(c: Context<AppContext>) {
  const supabase = getGomtmConfigSupabase(c);
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error || !user) {
    return {
      supabase: null,
      response: c.json({ error: "unauthorized" }, 401),
    };
  }

  return {
    supabase,
    response: null,
  };
}

function normalizeSingletonRpcRow<T>(data: T[] | T | null | undefined) {
  if (Array.isArray(data)) {
    if (data.length === 0) {
      return { record: null, multiple: false };
    }
    if (data.length === 1) {
      return { record: data[0], multiple: false };
    }
    return { record: null, multiple: true };
  }

  return { record: data ?? null, multiple: false };
}

function getGomtmConfigSupabase(c: Context<AppContext>): GomtmConfigSupabase {
  return getSupabase(c) as unknown as GomtmConfigSupabase;
}

function requireTrustedControlPlaneRequest(c: Context<AppContext>) {
  if (isTrustedControlPlaneRequest(c.req.raw)) {
    return null;
  }

  return c.json({ error: "forbidden" }, 403);
}

function isTrustedControlPlaneRequest(request: Request) {
  const requestUrl = new URL(request.url);
  const expectedHost = requestUrl.host;
  const origin = request.headers.get("origin");
  const referer = request.headers.get("referer");
  const secFetchSite = request.headers.get("sec-fetch-site");

  if (origin) {
    try {
      if (new URL(origin).host !== expectedHost) {
        return false;
      }
    } catch {
      return false;
    }
  } else if (referer) {
    try {
      if (new URL(referer).host !== expectedHost) {
        return false;
      }
    } catch {
      return false;
    }
  } else {
    return false;
  }

  if (secFetchSite && secFetchSite !== "same-origin" && secFetchSite !== "same-site") {
    return false;
  }

  return true;
}

function createControlPlaneRpcErrorResponse(c: Context<AppContext>, error: RpcErrorLike, fallbackMessage: string) {
  if (error.code === "P4030") {
    return c.json({ error: "forbidden" }, 403);
  }

  if (error.code === "P0002") {
    return c.json({ error: "not found" }, 404);
  }

  if (error.code === "23505") {
    return c.json({ error: "conflict" }, 409);
  }

  return c.json({ error: fallbackMessage }, 500);
}

function createRuntimeConfigErrorResponse(c: Context<AppContext>, error: RpcErrorLike) {
  if (error.code === "P4030") {
    return c.text("forbidden", 403);
  }

  if (error.code === "P0002") {
    return c.text("not found", 404);
  }

  return c.text("runtime config unavailable", 500);
}

async function getCurrentRuntimeConfig(supabase: GomtmConfigSupabase, profileName: string) {
  const { data, error } = await supabase.rpc<GomtmRuntimeConfigRecord[] | GomtmRuntimeConfigRecord | null>("gomtm_runtime_config_get", {
    p_name: profileName,
  });
  if (error) {
    return { error, multiple: false, record: null as GomtmRuntimeConfigRecord | null };
  }

  const runtimeConfig = normalizeSingletonRpcRow(data);
  if (runtimeConfig.multiple) {
    return { error: null, multiple: true, record: null as GomtmRuntimeConfigRecord | null };
  }
  if (!runtimeConfig.record || !runtimeConfig.record.config_document) {
    return { error: null, multiple: false, record: null as GomtmRuntimeConfigRecord | null };
  }

  return { error: null, multiple: false, record: runtimeConfig.record };
}

function buildSignedRuntimeConfigUrl(c: Context<AppContext>, profileName: string, secret: string) {
  const runtimePath = `${ApiPrefix}/gomtm/runtime-configs/${encodeURIComponent(profileName)}`;
  const expiresAt = Math.floor(Date.now() / 1000) + RUNTIME_URL_TTL_SECONDS;
  const signed = signRuntimeConfigPath({
    basePath: runtimePath,
    expiresAt,
    secret,
  });

  const runtimeUrl = new URL(runtimePath, c.req.url);
  runtimeUrl.searchParams.set("expires", String(signed.expiresAt));
  runtimeUrl.searchParams.set("sig", signed.signature);

  return runtimeUrl.toString();
}

function getRuntimeConfigSigningSecret(c: Context<AppContext>) {
  const boundSecret = (c.env as Record<string, unknown> | undefined)?.[GOMTM_RUNTIME_CONFIG_SIGNING_SECRET_ENV];
  if (typeof boundSecret === "string" && boundSecret) {
    return boundSecret;
  }

  return process.env[GOMTM_RUNTIME_CONFIG_SIGNING_SECRET_ENV] ?? "";
}
