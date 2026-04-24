export type ServerSelfNode = {
  peerId: string;
  platform: string;
  connectionAddr: string;
  runtimeStatus: string;
  lastError?: string;
};

export type CanonicalServerSelfNodeRecord = {
  connection_addr?: string;
  last_error?: string;
  peer_id?: string;
  platform?: string;
  runtime_status?: string;
};

function normalizeServerUrl(serverUrl: string) {
  const normalized = serverUrl.trim().replace(/\/+$/, "");
  if (normalized === "") {
    throw new Error("请先在 P2P 页面配置 gomtm server 地址。");
  }
  return normalized;
}

function asRecord(value: unknown) {
  return value !== null && typeof value === "object" ? (value as Record<string, unknown>) : null;
}

function asString(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

export async function fetchServerSelfNode(serverUrl: string): Promise<ServerSelfNode> {
  const normalizedServerUrl = normalizeServerUrl(serverUrl);
  const response = await fetch(`${normalizedServerUrl}/api/p2p/self`, {
    cache: "no-store",
    credentials: "omit",
    method: "GET",
  });

  if (!response.ok) {
    throw new Error(`请求 server self node 失败: ${response.status}`);
  }

  const payload = asRecord(await response.json());
  const node = asRecord(payload?.node) as CanonicalServerSelfNodeRecord | null;
  if (node == null) {
    throw new Error("gomtm server 未返回 self node truth。");
  }

  const peerId = asString(node.peer_id);
  if (peerId === "") {
    throw new Error("gomtm server self node truth 缺少有效 peer_id。");
  }

  return {
    peerId,
    platform: asString(node.platform),
    connectionAddr: asString(node.connection_addr),
    runtimeStatus: asString(node.runtime_status),
    lastError: asString(node.last_error) || undefined,
  };
}
