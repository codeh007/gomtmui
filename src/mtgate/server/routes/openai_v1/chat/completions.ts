import { type Context, Hono } from "hono";
import { getSupabaseAdmin } from "mtmsdk/supabase/supabase";
import { PLATFORM_CONFIGS, type PlatformName } from "@/lib/cloud-account/platform-configs";
import type { AppContext } from "../../../../types";

export const chatCompletionsRoute = new Hono<AppContext>();

/**
 * 开发备忘:
 * 1. 当前阶段,不要要求客户端填写api_key, 任意值都允许.
 * 2. 开发阶段,后端暂时使用高级权限. 以后再考虑如何结合用户上下文
 */

// Helper to map model ID to platform name
function getPlatformFromModel(modelId: string): PlatformName | null {
  if (modelId.startsWith("qwen")) return "qwen";
  return null;
}

chatCompletionsRoute.post("/:modelId/chat/completions", async (c: Context<AppContext>) => {
  const modelId = c.req.param("modelId");
  if (!modelId) {
    return c.json({ error: { message: "Missing modelId", type: "invalid_request_error" } }, 400);
  }
  let body: any;
  try {
    body = await c.req.json();
  } catch (_e) {
    return c.json({ error: { message: "Invalid JSON body", type: "invalid_request_error" } }, 400);
  }
  const platformName = getPlatformFromModel(modelId);
  if (!platformName || !PLATFORM_CONFIGS[platformName]) {
    return c.json(
      { error: { message: `Unsupported model or platform for model: ${modelId}`, type: "invalid_request_error" } },
      400,
    );
  }
  const sb = getSupabaseAdmin();
  const { data: account, error } = await sb
    .from("cloud_accounts")
    .select("*")
    .eq("platform_name", platformName)
    .eq("status", "active")
    .order("last_used_at", { ascending: true }) // Round-robin strategy: use the least recently used account
    .limit(1)
    .single();

  if (error || !account) {
    console.error(`[chat] No active account found for ${platformName}`, error);
    return c.json(
      {
        error: {
          message: `No active account available for platform: ${platformName}. Please add an active account in settings.`,
          type: "server_error",
        },
      },
      503,
    );
  }
  const now = new Date().toISOString();
  c.executionCtx.waitUntil(
    (async () => {
      const { error } = await sb
        .from("cloud_accounts")
        .update({
          last_used_at: now,
          use_count: (account.use_count || 0) + 1,
        })
        .eq("id", account.id);

      if (error) {
        console.error(`[chat] Failed to update stats for account ${account.id}:`, error);
      }
    })(),
  );

  let upstreamUrl = "";
  if (platformName === "qwen") {
    // DashScope compatible API
    // https://help.aliyun.com/zh/dashscope/developer-reference/compatibility-of-openai-with-dashscope
    upstreamUrl = "https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions";
    if (!body.model) {
      body.model = modelId;
    }
  } else {
    return c.json(
      { error: { message: `Platform ${platformName} proxy not implemented yet`, type: "not_implemented" } },
      501,
    );
  }

  // Proxy Request
  try {
    const upstreamHeaders: Record<string, string> = {
      "Content-Type": "application/json",
      Authorization: `Bearer ${account.access_token}`,
      Accept: c.req.header("Accept") || "application/json",
    };

    const response = await fetch(upstreamUrl, {
      method: "POST",
      headers: upstreamHeaders,
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error(`[chat] Upstream error from ${platformName}: ${response.status} ${errText}`);

      if (response.status === 401) {
        c.executionCtx.waitUntil(
          (async () => {
            await sb
              .from("cloud_accounts")
              .update({
                status: "token_expired",
                status_reason: "Upstream returned 401 Unauthorized",
              })
              .eq("id", account.id);
          })(),
        );
      }

      try {
        const errJson = JSON.parse(errText);
        return c.json(errJson, response.status as any);
      } catch {
        return c.text(errText, response.status as any);
      }
    }

    return new Response(response.body, {
      status: response.status,
      headers: response.headers,
    });
  } catch (error: unknown) {
    const err = error as Error;
    console.error(`[chat] Proxy error:`, err);
    return c.json({ error: { message: "Internal Proxy Error", details: err.message } }, 500);
  }
});
