import { z } from "zod";

export const MIXED_PROXY_DEFAULT_PORT = 10085;
export const subscriptionFetchPath = "/api/cf/mproxy/subscription/fetch";
export const mproxyControlPlaneHeader = "x-gomtm-control-plane";
export const mproxyControlPlaneHeaderValue = "mproxy-subscription-import";
export const proxyEndpointStorageKey = "gomtm:mproxy:proxy-endpoint";
export const mproxyRpcNames = {
  subscriptionImport: "mproxy_subscription_import",
  nodeList: "mproxy_node_list",
  extractCreate: "mproxy_extract_create",
  extractList: "mproxy_extract_list",
  extractUpdate: "mproxy_extract_update",
  extractDelete: "mproxy_extract_delete",
} as const;

export const sourceTypeSchema = z.enum(["paste", "url"]);

const outboundSchema = z
  .object({
    type: z.string().min(1),
    tag: z.string().min(1),
    server: z.string().optional(),
    server_port: z.number().int().optional(),
  })
  .passthrough();

export const subscriptionPayloadSchema = z
  .object({
    outbounds: z.array(outboundSchema).min(1, "订阅中至少需要一个 outbound 节点"),
  })
  .passthrough();

export const subscriptionFetchResponseSchema = z.object({
  body: z.string(),
  contentType: z.string().nullable(),
});

export const subscriptionImportResultSchema = z.array(
  z.object({
    subscription_id: z.string().uuid(),
    inserted_count: z.number().int(),
    updated_count: z.number().int(),
  }),
);

export const mproxyNodeRowSchema = z.object({
  id: z.string().uuid(),
  subscription_id: z.string().uuid(),
  source_name: z.string(),
  tag: z.string(),
  protocol: z.string(),
  server: z.string(),
  server_port: z.number().int(),
  disabled: z.boolean(),
});

export const mproxyNodeListSchema = z.array(mproxyNodeRowSchema);

export const extractCreateResultSchema = z.array(
  z.object({
    extract_id: z.string().uuid(),
    username: z.string(),
    password: z.string(),
    expires_at: z.string(),
  }),
);

export const mproxyExtractRowSchema = z.object({
  id: z.string().uuid(),
  display_name: z.string(),
  username: z.string(),
  password: z.string(),
  expires_at: z.string(),
  disabled: z.boolean(),
  node_id: z.string().uuid(),
  node_tag: z.string(),
  node_protocol: z.string(),
});

export const mproxyExtractListSchema = z.array(mproxyExtractRowSchema);

export const mproxyExtractUpdateSchema = z.object({
  id: z.string().uuid(),
  display_name: z.string(),
  username: z.string(),
  password: z.string(),
  expires_at: z.string(),
  disabled: z.boolean(),
  node_id: z.string().uuid(),
  user_id: z.string().uuid(),
  created_at: z.string(),
  updated_at: z.string(),
});

export type SubscriptionPayload = z.infer<typeof subscriptionPayloadSchema>;
export type SubscriptionImportResult = z.infer<typeof subscriptionImportResultSchema>[number];
export type MProxyNodeRow = z.infer<typeof mproxyNodeRowSchema>;
export type ExtractCreateResult = z.infer<typeof extractCreateResultSchema>[number];
export type MProxyExtractRow = z.infer<typeof mproxyExtractRowSchema>;
export type MProxyExtractUpdateRow = z.infer<typeof mproxyExtractUpdateSchema>;
export const proxyEndpointSchema = z
  .string()
  .trim()
  .min(1, "请输入代理入口 host:port")
  .transform((value) => normalizeProxyEndpoint(value));

export function parseSubscriptionPayload(rawText: string) {
  const parsed = JSON.parse(rawText) as unknown;
  return subscriptionPayloadSchema.parse(parsed);
}

export function buildManualSourceUrl() {
  return `https://manual.invalid/paste/${Date.now()}`;
}

export function defaultExpiryValue(days = 30) {
  const date = new Date();
  date.setMinutes(date.getMinutes() - date.getTimezoneOffset());
  date.setDate(date.getDate() + days);
  return date.toISOString().slice(0, 16);
}

export function toDateTimeLocalValue(value: string) {
  const date = new Date(value);
  date.setMinutes(date.getMinutes() - date.getTimezoneOffset());
  return date.toISOString().slice(0, 16);
}

export function fromDateTimeLocalValue(value: string) {
  return new Date(value).toISOString();
}

export function readStoredProxyEndpoint() {
  if (typeof window === "undefined") {
    return "";
  }

  return window.localStorage.getItem(proxyEndpointStorageKey)?.trim() ?? "";
}

export function writeStoredProxyEndpoint(value: string) {
  if (typeof window === "undefined") {
    return;
  }

  const trimmedValue = value.trim();
  if (!trimmedValue) {
    window.localStorage.removeItem(proxyEndpointStorageKey);
    return;
  }

  window.localStorage.setItem(proxyEndpointStorageKey, trimmedValue);
}

export function buildProxyUri(
  scheme: "socks5" | "http",
  username: string,
  password: string,
  endpoint: string,
) {
  const { host, port } = splitProxyEndpoint(endpoint);
  return `${scheme}://${encodeURIComponent(username)}:${encodeURIComponent(password)}@${host}:${port}`;
}

export function normalizeProxyEndpoint(value: string) {
  const trimmedValue = value.trim();
  const candidate = trimmedValue.includes("://") ? trimmedValue : `http://${trimmedValue}`;
  const parsed = new URL(candidate);

  if (!parsed.hostname) {
    throw new Error("代理入口必须包含主机名");
  }

  if (parsed.username || parsed.password || parsed.search || parsed.hash) {
    throw new Error("代理入口只允许 host:port");
  }

  const normalizedPath = parsed.pathname.replace(/\/+$/, "");
  if (normalizedPath && normalizedPath !== "/") {
    throw new Error("代理入口不应包含路径");
  }

  return `${parsed.hostname}:${parsed.port || String(MIXED_PROXY_DEFAULT_PORT)}`;
}

export function splitProxyEndpoint(endpoint: string) {
  const normalized = normalizeProxyEndpoint(endpoint);
  const lastColonIndex = normalized.lastIndexOf(":");
  if (lastColonIndex <= 0) {
    throw new Error("代理入口格式必须为 host:port");
  }

  return {
    host: normalized.slice(0, lastColonIndex),
    port: Number(normalized.slice(lastColonIndex + 1)),
  };
}
