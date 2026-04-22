import { parsePeerCapabilityDescriptors, type PeerCapabilityDescriptor } from "./discovery-contracts";

function normalizeServerUrl(serverUrl: string) {
  const normalized = serverUrl.trim().replace(/\/+$/, "");
  if (normalized === "") {
    throw new Error("请先在 P2P 主页面配置后端地址。");
  }
  return normalized;
}

async function parseErrorMessage(response: Response) {
  try {
    const payload = (await response.json()) as Record<string, unknown>;
    const message = typeof payload.message === "string" ? payload.message.trim() : "";
    const error = typeof payload.error === "string" ? payload.error.trim() : "";
    return message || error || `请求失败: ${response.status}`;
  } catch {
    return `请求失败: ${response.status}`;
  }
}

export async function fetchServerPeerCapabilities(params: {
  peerId: string;
  serverUrl: string;
}): Promise<PeerCapabilityDescriptor[]> {
  const serverUrl = normalizeServerUrl(params.serverUrl);
  const peerId = params.peerId.trim();

  const response = await fetch(`${serverUrl}/api/p2p/peers/${encodeURIComponent(peerId)}/capabilities`, {
    cache: "no-store",
    credentials: "omit",
    method: "GET",
  });

  if (!response.ok) {
    throw new Error(await parseErrorMessage(response));
  }

  return parsePeerCapabilityDescriptors(await response.json());
}

export async function postServerPeerRemoteCommand(params: {
  command: string;
  params?: Record<string, unknown>;
  peerId: string;
  serverUrl: string;
}) {
  const serverUrl = normalizeServerUrl(params.serverUrl);
  const peerId = params.peerId.trim();

  const response = await fetch(`${serverUrl}/api/p2p/peers/${encodeURIComponent(peerId)}/remote_control/commands`, {
    body: JSON.stringify({
      command: params.command,
      params: params.params ?? {},
    }),
    cache: "no-store",
    credentials: "omit",
    headers: {
      "content-type": "application/json",
    },
    method: "POST",
  });

  if (!response.ok) {
    throw new Error(await parseErrorMessage(response));
  }

  return await response.json();
}
