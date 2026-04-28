import { mproxyExtractRowSchema } from "@/components/mproxy/schemas";
import { type Context, Hono } from "hono";
import { z } from "zod";
import { getSupabase } from "mtmsdk/supabase/supabase";
import type { AppContext } from "../types";

export const mproxyRoute = new Hono<AppContext>();

const FETCH_TIMEOUT_MS = 8_000;
const MAX_RESPONSE_BYTES = 1_000_000;
const CONTROL_PLANE_HEADER = "x-gomtm-control-plane";
const CONTROL_PLANE_HEADER_VALUE = "mproxy-subscription-import";
const NO_STORE_JSON_HEADERS = {
  "cache-control": "no-store",
  "content-type": "application/json; charset=utf-8",
};
const NO_STORE_TEXT_HEADERS = {
  "cache-control": "no-store",
  "content-type": "text/plain; charset=utf-8",
};

const extractIdParamSchema = z.object({
  extract_id: z.string().uuid(),
});

const vmessOutboundSchema = z
  .object({
    alter_id: z.number().int().optional(),
    packet_encoding: z.string().optional(),
    security: z.string().optional(),
    server: z.string().min(1),
    server_port: z.number().int().positive(),
    tls: z
      .object({
        alpn: z.array(z.string()).optional(),
        enabled: z.boolean().optional(),
        insecure: z.boolean().optional(),
        server_name: z.string().optional(),
        utls: z
          .object({
            fingerprint: z.string().optional(),
          })
          .passthrough()
          .optional(),
      })
      .passthrough()
      .optional(),
    transport: z
      .object({
        headers: z.record(z.string(), z.unknown()).optional(),
        host: z.union([z.string(), z.array(z.string())]).optional(),
        path: z.string().optional(),
        service_name: z.string().optional(),
        type: z.string().optional(),
      })
      .passthrough()
      .optional(),
    type: z.literal("vmess"),
    uuid: z.string().min(1),
  })
  .passthrough();

type MproxyExtractRow = z.infer<typeof mproxyExtractRowSchema>;
type ExtractListRpcClient = {
  rpc(
    functionName: "mproxy_extract_list",
  ): Promise<{ data: MproxyExtractRow[] | null; error: { code?: string | null; message: string } | null }>;
};

type ResolvedVmessExtract = {
  displayName: string;
  extractId: string;
  trafficMode: "standard" | "mitm";
  upstreamProtocol: "vmess";
  upstreamTag: string;
  vmessOutbound: z.infer<typeof vmessOutboundSchema>;
};

mproxyRoute.post("/mproxy/subscription/fetch", async (c) => {
  if (!isTrustedDashboardRequest(c.req.raw)) {
    return jsonNoStore({ error: "forbidden" }, 403);
  }

  const supabase = getSupabase(c);
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();
  if (authError || !user) {
    return jsonNoStore({ error: "unauthorized" }, 401);
  }

  const payload = await c.req.json().catch(() => null);
  const targetUrl =
    payload && typeof payload === "object" && "url" in payload && typeof payload.url === "string" ? payload.url.trim() : "";
  if (!targetUrl) {
    return jsonNoStore({ error: "url is required" }, 400);
  }

  let parsedUrl: URL;
  try {
    parsedUrl = new URL(targetUrl);
  } catch {
    return jsonNoStore({ error: "url is invalid" }, 400);
  }

  const validationError = validateRemoteUrl(parsedUrl);
  if (validationError) {
    return jsonNoStore({ error: validationError }, 400);
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(new Error("fetch timeout")), FETCH_TIMEOUT_MS);

  try {
    const response = await fetch(parsedUrl, {
      headers: {
        accept: "application/json,text/plain;q=0.9,*/*;q=0.8",
        "user-agent": "gomtmui-mproxy-import/1.0",
      },
      redirect: "manual",
      signal: controller.signal,
    });

    if (isRedirectStatus(response.status) || response.headers.has("location")) {
      return jsonNoStore({ error: "redirects are not allowed" }, 400);
    }

    const actualUrl = response.url ? new URL(response.url) : parsedUrl;
    const actualValidationError = validateRemoteUrl(actualUrl);
    if (actualValidationError) {
      return jsonNoStore({ error: actualValidationError }, 400);
    }

    if (!response.ok) {
      return jsonNoStore({ error: `upstream request failed with status ${response.status}` }, 502);
    }

    const body = await readBoundedText(response, controller.signal);

    return jsonNoStore({ body, contentType: response.headers.get("content-type") });
  } catch (error) {
    const message = controller.signal.aborted ? "fetch timeout" : error instanceof Error ? error.message : String(error);
    return jsonNoStore({ error: message }, 502);
  } finally {
    clearTimeout(timeoutId);
  }
});

mproxyRoute.get("/mproxy/extracts/:extract_id/vmess/profile", async (c) => {
  const resolved = await resolveOwnedVmessExtract(c);
  if (resolved instanceof Response) {
    return resolved;
  }

  const profile = buildVmessProfile(resolved);
  const uri = buildVmessUri(profile);
  return jsonNoStore(
    {
      entry: "vmess_wrapper",
      extract_id: resolved.extractId,
      profile,
      traffic_mode: resolved.trafficMode,
      upstream_protocol: resolved.upstreamProtocol,
      upstream_tag: resolved.upstreamTag,
      uri,
    },
    200,
  );
});

mproxyRoute.get("/mproxy/extracts/:extract_id/vmess/subscription", async (c) => {
  const resolved = await resolveOwnedVmessExtract(c);
  if (resolved instanceof Response) {
    return resolved;
  }

  const uri = buildVmessUri(buildVmessProfile(resolved));
  return textNoStore(encodeBase64(`${uri}\n`), 200);
});

async function resolveOwnedVmessExtract(c: Context<AppContext>) {
  const parsedParams = extractIdParamSchema.safeParse({
    extract_id: c.req.param("extract_id"),
  });
  if (!parsedParams.success) {
    return jsonNoStore({ error: "extract_id is invalid" }, 400);
  }

  const supabase = getSupabase(c);
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();
  if (authError || !user) {
    return jsonNoStore({ error: "unauthorized" }, 401);
  }

  const extractClient = supabase as unknown as ExtractListRpcClient;
  const { data, error } = await extractClient.rpc("mproxy_extract_list");
  if (error) {
    return jsonNoStore({ error: error.message }, 502);
  }

  const rows = z.array(mproxyExtractRowSchema).safeParse(data ?? []);
  if (!rows.success) {
    return jsonNoStore({ error: "extract list payload is invalid" }, 502);
  }

  const row = rows.data.find((candidate) => candidate.id === parsedParams.data.extract_id);
  if (!row) {
    return jsonNoStore({ error: "extract route not found" }, 404);
  }

  if (row.allow_vmess_wrapper !== true) {
    return jsonNoStore({ error: "vmess wrapper is disabled for this extract" }, 403);
  }

  if (row.upstream_protocol !== "vmess") {
    return jsonNoStore({ error: "upstream protocol is not vmess" }, 400);
  }

  if (!row.upstream_outbound) {
    return jsonNoStore({ error: "extract route is missing upstream outbound" }, 400);
  }

  const vmessOutbound = vmessOutboundSchema.safeParse(row.upstream_outbound);
  if (!vmessOutbound.success) {
    return jsonNoStore({ error: "extract route vmess outbound is invalid" }, 400);
  }

  const upstreamTag = row.upstream_tag?.trim() || row.display_name?.trim() || "VMess extract";
  const displayName = row.display_name?.trim() || upstreamTag;
  const trafficMode = row.traffic_mode === "mitm" ? "mitm" : "standard";

  return {
    displayName,
    extractId: parsedParams.data.extract_id,
    trafficMode,
    upstreamProtocol: "vmess",
    upstreamTag,
    vmessOutbound: vmessOutbound.data,
  } satisfies ResolvedVmessExtract;
}

function buildVmessProfile(resolved: ResolvedVmessExtract) {
  const transportType = normalizeTransportType(resolved.vmessOutbound.transport?.type);
  const host = normalizeHost(resolved.vmessOutbound.transport?.host);
  const tls = resolved.vmessOutbound.tls;
  const displayName = resolved.trafficMode === "mitm" ? `${resolved.displayName} [MITM]` : resolved.displayName;

  return {
    add: resolved.vmessOutbound.server,
    aid: String(resolved.vmessOutbound.alter_id ?? 0),
    alpn: tls?.alpn?.[0] ?? "",
    fp: tls?.utls?.fingerprint ?? "",
    host,
    id: resolved.vmessOutbound.uuid,
    net: transportType,
    path: transportType === "grpc" ? resolved.vmessOutbound.transport?.service_name ?? "" : resolved.vmessOutbound.transport?.path ?? "",
    port: String(resolved.vmessOutbound.server_port),
    ps: displayName,
    scy: resolved.vmessOutbound.security ?? resolved.vmessOutbound.packet_encoding ?? "auto",
    sni: tls?.server_name ?? "",
    tls: tls?.enabled ? "tls" : "",
    type: "none",
    v: "2",
  };
}

function buildVmessUri(profile: ReturnType<typeof buildVmessProfile>) {
  return `vmess://${encodeBase64(JSON.stringify(profile))}`;
}

function encodeBase64(value: string) {
  if (typeof Buffer !== "undefined") {
    return Buffer.from(value, "utf-8").toString("base64");
  }

  return globalThis.btoa(value);
}

function normalizeTransportType(value?: string) {
  if (value === "ws" || value === "grpc" || value === "http" || value === "tcp") {
    return value;
  }

  return "tcp";
}

function normalizeHost(value?: string | string[]) {
  if (Array.isArray(value)) {
    return value[0] ?? "";
  }

  return value ?? "";
}

function jsonNoStore(payload: unknown, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: NO_STORE_JSON_HEADERS,
  });
}

function textNoStore(payload: string, status = 200) {
  return new Response(payload, {
    status,
    headers: NO_STORE_TEXT_HEADERS,
  });
}

async function readBoundedText(response: Response, signal: AbortSignal) {
  if (!response.body) {
    return "";
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  const chunks: string[] = [];
  let totalBytes = 0;

  while (true) {
    if (signal.aborted) {
      throw new Error("fetch timeout");
    }

    const { done, value } = await reader.read();
    if (done) {
      break;
    }

    totalBytes += value.byteLength;
    if (totalBytes > MAX_RESPONSE_BYTES) {
      throw new Error("response too large");
    }

    chunks.push(decoder.decode(value, { stream: true }));
  }

  chunks.push(decoder.decode());
  return chunks.join("");
}

function isRedirectStatus(status: number) {
  return status >= 300 && status < 400;
}

function isTrustedDashboardRequest(request: Request) {
  if (request.headers.get(CONTROL_PLANE_HEADER) !== CONTROL_PLANE_HEADER_VALUE) {
    return false;
  }

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

function validateRemoteUrl(url: URL) {
  if (url.protocol !== "https:") {
    return "https only";
  }

  if (isPrivateOrLocalHostname(url.hostname)) {
    return "private host blocked";
  }

  return null;
}

function isPrivateOrLocalHostname(hostname: string) {
  const normalized = hostname.trim().toLowerCase().replace(/^\[(.*)\]$/, "$1");
  if (!normalized) {
    return true;
  }

  if (normalized === "localhost" || normalized === "::1" || normalized === "0.0.0.0") {
    return true;
  }

  if (normalized.endsWith(".local")) {
    return true;
  }

  if (
    /^127\./.test(normalized) ||
    /^10\./.test(normalized) ||
    /^192\.168\./.test(normalized) ||
    /^169\.254\./.test(normalized)
  ) {
    return true;
  }

  const match172 = normalized.match(/^172\.(\d{1,3})\./);
  if (match172) {
    const secondOctet = Number(match172[1]);
    if (secondOctet >= 16 && secondOctet <= 31) {
      return true;
    }
  }

  if (/^(fc|fd)[0-9a-f:]+$/i.test(normalized) || /^fe80:/i.test(normalized)) {
    return true;
  }

  return false;
}
