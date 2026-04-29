import { mproxyCaCertPath, mproxyCaStateSchema, mproxyExtractRowSchema } from "@/components/mproxy/schemas";
import { type Context, Hono } from "hono";
import { z } from "zod";
import { getSupabase } from "mtmsdk/supabase/supabase";
import { generateMproxyCA } from "../lib/mproxy-ca";
import {
  buildMproxyVmessWrapperProfile,
  readWrapperSecretFromConfigYaml,
  resolveWrapperServerOrigin,
} from "../lib/mproxy-vmess-wrapper";
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

type MproxyExtractRow = z.infer<typeof mproxyExtractRowSchema>;
type MproxyCAStateRow = z.infer<typeof mproxyCaStateSchema>;
type RpcError = { code?: string | null; message: string };
type RpcSingleton<TRecord> = TRecord[] | TRecord | null;
type ExtractListRpcClient = {
  rpc(
    functionName: "mproxy_extract_list",
  ): Promise<{ data: MproxyExtractRow[] | null; error: RpcError | null }>;
};
type CAStateRpcClient = {
  rpc(functionName: "mproxy_ca_state_get"): Promise<{ data: MproxyCAStateRow[] | null; error: RpcError | null }>;
};
type CAPermissionRpcClient = {
  rpc(
    functionName: "has_permission",
    args: { p_action: string; p_resource: string },
  ): Promise<{ data: boolean | null; error: RpcError | null }>;
};
type CAInitRpcClient = {
  rpc(
    functionName: "mproxy_ca_init",
    args: {
      p_cert_pem: string;
      p_not_after: string;
      p_not_before: string;
      p_private_key_pem: string;
      p_sha256_fingerprint: string;
      p_subject_common_name: string;
    },
  ): Promise<{ data: MproxyCAStateRow[] | null; error: RpcError | null }>;
};

type RuntimeConfigRecord = {
  config_yaml?: string | null;
  version?: number | null;
};

type RuntimeConfigRpcClient = {
  rpc(
    functionName: "gomtm_runtime_config_get",
    args: { p_name: string },
  ): Promise<{ data: RpcSingleton<RuntimeConfigRecord>; error: RpcError | null }>;
};

type CACertRecord = {
  cert_pem?: string | null;
};

type CACertRpcClient = {
  rpc(functionName: "mproxy_ca_cert_get"): Promise<{ data: RpcSingleton<CACertRecord>; error: RpcError | null }>;
};

type ResolvedVmessExtract = {
  displayName: string;
  extractId: string;
  trafficMode: "standard" | "mitm";
  upstreamTag: string;
  password: string;
  username: string;
};

const selectedServerRuntimeSchema = z.object({
  config_profile_name: z.string().min(1),
  config_profile_version: z.coerce.string().min(1),
  vmess_wrapper: z.object({
    enabled: z.boolean(),
    path: z.string().optional(),
    status: z.string(),
  }),
});

const defaultCAState: MproxyCAStateRow = {
  download_path: mproxyCaCertPath,
  file_name: "gomtm-mitm-ca.crt",
  initialized: false,
  not_after: null,
  not_before: null,
  sha256_fingerprint: null,
  subject_common_name: null,
};

mproxyRoute.get("/mproxy/mitm/ca/state", async (c) => {
  const supabase = getSupabase(c);
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();
  if (authError || !user) {
    return jsonNoStore({ error: "unauthorized" }, 401);
  }

  const caStateClient = supabase as unknown as CAStateRpcClient;
  const { data, error } = await caStateClient.rpc("mproxy_ca_state_get");
  if (error) {
    return jsonNoStore({ error: error.message }, 502);
  }

  const rows = z.array(mproxyCaStateSchema).safeParse(data ?? []);
  if (!rows.success) {
    return jsonNoStore({ error: "ca state payload is invalid" }, 502);
  }

  return jsonNoStore(normalizeCAState(rows.data[0] ?? defaultCAState), 200);
});

mproxyRoute.post("/mproxy/mitm/ca/init", async (c) => {
  const supabase = getSupabase(c);
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();
  if (authError || !user) {
    return jsonNoStore({ error: "unauthorized" }, 401);
  }

  const permissionClient = supabase as unknown as CAPermissionRpcClient;
  const permission = await permissionClient.rpc("has_permission", {
    p_action: "manage",
    p_resource: "user_roles",
  });
  if (permission.error) {
    return jsonNoStore({ error: permission.error.message }, 502);
  }
  if (permission.data !== true) {
    return jsonNoStore({ error: "forbidden" }, 403);
  }

  const generated = await generateMproxyCA();
  const caInitClient = supabase as unknown as CAInitRpcClient;
  const result = await caInitClient.rpc("mproxy_ca_init", {
    p_cert_pem: generated.certPem,
    p_not_after: generated.notAfter,
    p_not_before: generated.notBefore,
    p_private_key_pem: generated.privateKeyPem,
    p_sha256_fingerprint: generated.sha256Fingerprint,
    p_subject_common_name: generated.subjectCommonName,
  });
  if (result.error) {
    return jsonNoStore({ error: result.error.message }, 502);
  }

  const rows = z.array(mproxyCaStateSchema).safeParse(result.data ?? []);
  if (!rows.success) {
    return jsonNoStore({ error: "ca init payload is invalid" }, 502);
  }

  return jsonNoStore(
    normalizeCAState(
      rows.data[0] ?? {
        ...defaultCAState,
        initialized: true,
        not_after: generated.notAfter,
        not_before: generated.notBefore,
        sha256_fingerprint: generated.sha256Fingerprint,
        subject_common_name: generated.subjectCommonName,
      },
    ),
    200,
  );
});

mproxyRoute.get("/mproxy/mitm/ca/cert", async (c) => {
  const supabase = getSupabase(c);
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();
  if (authError || !user) {
    return jsonNoStore({ error: "unauthorized" }, 401);
  }

  const certClient = supabase as unknown as CACertRpcClient;
  const result = await certClient.rpc("mproxy_ca_cert_get");
  if (result.error) {
    return jsonNoStore({ error: result.error.message }, 502);
  }

  const certPem = normalizeSingletonRpcRow(result.data)?.cert_pem?.trim() ?? "";
  if (!certPem) {
    return jsonNoStore({ error: "ca cert unavailable" }, 404);
  }

  return new Response(certPem, {
    status: 200,
    headers: {
      "cache-control": "no-store",
      "content-disposition": 'attachment; filename="gomtm-mitm-ca.crt"',
      "content-type": "application/x-x509-ca-cert",
    },
  });
});

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

  const wrapper = await resolveVmessWrapperProfile(c, resolved);
  if (wrapper instanceof Response) {
    return wrapper;
  }

  const profile = wrapper.profile;
  const uri = buildVmessUri(profile);
  return jsonNoStore(
    {
      entry: "vmess_wrapper",
      extract_id: resolved.extractId,
      profile,
      traffic_mode: resolved.trafficMode,
      upstream_protocol: "vmess_wrapper",
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

  const wrapper = await resolveVmessWrapperProfile(c, resolved);
  if (wrapper instanceof Response) {
    return wrapper;
  }

  const uri = buildVmessUri(wrapper.profile);
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

  const username = row.username?.trim() ?? "";
  const password = row.password?.trim() ?? "";
  if (!username || !password) {
    return jsonNoStore({ error: "extract route is missing proxy credentials" }, 400);
  }

  const upstreamTag = row.upstream_tag?.trim() || row.display_name?.trim() || "MProxy extract";
  const displayName = row.display_name?.trim() || upstreamTag;
  const trafficMode = row.traffic_mode === "mitm" ? "mitm" : "standard";

  return {
    displayName,
    extractId: parsedParams.data.extract_id,
    password,
    trafficMode,
    upstreamTag,
    username,
  } satisfies ResolvedVmessExtract;
}

async function resolveVmessWrapperProfile(c: Context<AppContext>, resolved: ResolvedVmessExtract) {
  let serverOrigin: string;
  try {
    serverOrigin = resolveWrapperServerOrigin(c.req.query("server_origin") ?? "", process.env.NEXT_PUBLIC_GOMTM_SERVER_URL ?? "");
  } catch (error) {
    return jsonNoStore({ error: error instanceof Error ? error.message : "invalid gomtm server origin" }, 400);
  }

  let serverRuntime: z.infer<typeof selectedServerRuntimeSchema>;
  try {
    serverRuntime = await resolveSelectedServerRuntime(serverOrigin);
  } catch (error) {
    return jsonNoStore(
      { error: error instanceof Error ? error.message : "failed to load gomtm server runtime metadata" },
      502,
    );
  }

  if (serverRuntime.vmess_wrapper.enabled !== true) {
    return jsonNoStore({ error: "selected gomtm server vmess wrapper is unavailable" }, 409);
  }

  const configClient = getSupabase(c) as unknown as RuntimeConfigRpcClient;
  const runtimeConfig = await configClient.rpc("gomtm_runtime_config_get", {
    p_name: serverRuntime.config_profile_name,
  });
  if (runtimeConfig.error) {
    return jsonNoStore({ error: runtimeConfig.error.message }, 502);
  }

  const configYaml = normalizeSingletonRpcRow(runtimeConfig.data)?.config_yaml?.trim() ?? "";
  const runtimeConfigVersion = normalizeSingletonRpcRow(runtimeConfig.data)?.version;
  if (!configYaml) {
    return jsonNoStore({ error: "published runtime config not found" }, 404);
  }
  if (String(runtimeConfigVersion ?? "") !== serverRuntime.config_profile_version) {
    return jsonNoStore({ error: "selected gomtm server runtime config version does not match published config" }, 409);
  }

  let secretB64: string;
  try {
    secretB64 = readWrapperSecretFromConfigYaml(configYaml);
  } catch (error) {
    return jsonNoStore({ error: error instanceof Error ? error.message : "invalid runtime config" }, 502);
  }

  try {
    const profile = await buildMproxyVmessWrapperProfile({
      displayName: resolved.displayName,
      password: resolved.password,
      secretB64,
      serverOrigin,
      trafficMode: resolved.trafficMode,
      username: resolved.username,
    });

    return { profile };
  } catch (error) {
    return jsonNoStore({ error: error instanceof Error ? error.message : "failed to build vmess wrapper profile" }, 502);
  }
}

function buildVmessUri(profile: Awaited<ReturnType<typeof buildMproxyVmessWrapperProfile>>) {
  return `vmess://${encodeBase64(JSON.stringify(profile))}`;
}

function encodeBase64(value: string) {
  if (typeof Buffer !== "undefined") {
    return Buffer.from(value, "utf-8").toString("base64");
  }

  return globalThis.btoa(value);
}

function jsonNoStore(payload: unknown, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: NO_STORE_JSON_HEADERS,
  });
}

function normalizeSingletonRpcRow<TRecord>(data: RpcSingleton<TRecord>) {
  if (Array.isArray(data)) {
    return data[0] ?? null;
  }

  return data;
}

function normalizeCAState(state: MproxyCAStateRow): MproxyCAStateRow {
  return {
    ...state,
    download_path: mproxyCaCertPath,
  };
}

async function resolveSelectedServerRuntime(serverOrigin: string) {
  const response = await fetch(new URL("/api/mproxy/runtime", serverOrigin), {
    cache: "no-store",
  });
  const body = await response.json().catch(() => null);
  if (!response.ok) {
    const message = body && typeof body === "object" && "error" in body && typeof body.error === "string"
      ? body.error
      : "failed to load gomtm server runtime metadata";
    throw new Error(message);
  }

  return selectedServerRuntimeSchema.parse(body);
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
