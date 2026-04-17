const CONNECTION_RUNTIME_STORAGE_KEY = "gomtm:p2p:connection-runtime";
const SERVER_URL_STORAGE_KEY = "gomtm:p2p:server-url";
const BROWSER_IDENTITY_STORAGE_KEY = "gomtm:p2p:browser-identity-v1";
const DEFAULT_SERVER_URL = (process.env.NEXT_PUBLIC_GOMTM_PUBLIC_URL ?? "").trim();

export type ResolvedConnectionEntryTarget = {
  connectionAddr: string;
  transport: "webtransport" | "ws";
};

function hasProtocolSegment(value: string, protocol: string) {
  return value.split("/").includes(protocol);
}

function isBrowserDialableConnectionAddr(value: string) {
  if (!hasProtocolSegment(value, "p2p")) {
    return false;
  }

  if (hasProtocolSegment(value, "webtransport")) {
    return true;
  }

  return hasProtocolSegment(value, "webtransport") || (hasProtocolSegment(value, "tls") && hasProtocolSegment(value, "ws")) || hasProtocolSegment(value, "wss");
}

export function normalizeBrowserConnectionAddr(value: string) {
  const trimmed = value.trim();
  if (trimmed === "") {
    return trimmed;
  }

  const normalizedSegments = trimmed.split("/");
  for (let index = 0; index < normalizedSegments.length; index += 1) {
    if (normalizedSegments[index] === "wss") {
      normalizedSegments[index] = "ws";
      if (normalizedSegments[index - 1] !== "tls") {
        normalizedSegments.splice(index, 0, "tls");
        index += 1;
      }
    }
  }
  if (trimmed.includes("/tcp/443/ws/") && !trimmed.includes("/tls/ws/")) {
    const joined = normalizedSegments.join("/");
    return joined.replace("/tcp/443/ws/", "/tcp/443/tls/ws/");
  }
  const normalizedInput = normalizedSegments.join("/");

  if (!normalizedInput.includes("/webtransport") || !normalizedInput.includes("/certhash/")) {
    return normalizedInput;
  }

  const segments = normalizedInput.split("/");
  const normalized: string[] = [];
  let seenCertHash = false;
  for (let index = 0; index < segments.length; index += 1) {
    const segment = segments[index];
    if (segment !== "certhash") {
      normalized.push(segment);
      continue;
    }
    const hashValue = segments[index + 1];
    if (hashValue == null) {
      break;
    }
    if (!seenCertHash) {
      normalized.push(segment, hashValue);
      seenCertHash = true;
    }
    index += 1;
  }

  return normalized.join("/");
}

export function shouldAllowPrivateConnectionEntryMultiaddr(candidate: string, connectionAddr: string) {
  const normalizedCandidate = normalizeBrowserConnectionAddr(candidate);
  if (normalizedCandidate === "") {
    return false;
  }
  return normalizedCandidate === normalizeBrowserConnectionAddr(connectionAddr);
}

export function readStoredServerUrl() {
  if (typeof window === "undefined") {
    return DEFAULT_SERVER_URL;
  }

  try {
    const rawServerUrl = window.localStorage.getItem(SERVER_URL_STORAGE_KEY);
    const serverUrl = rawServerUrl?.trim() ?? "";
    return serverUrl === "" ? DEFAULT_SERVER_URL : serverUrl;
  } catch {
    return DEFAULT_SERVER_URL;
  }
}

export function persistStoredServerUrl(serverUrl: string | null | undefined) {
  if (typeof window === "undefined") {
    return;
  }

  try {
    const normalized = serverUrl?.trim() ?? "";
    if (normalized === "") {
      window.localStorage.removeItem(SERVER_URL_STORAGE_KEY);
      return;
    }
    window.localStorage.setItem(SERVER_URL_STORAGE_KEY, normalized);
  } catch {
    // best effort only
  }
}

export function clearStoredConnectionRuntime() {
  if (typeof window === "undefined") {
    return;
  }

  try {
    window.localStorage.removeItem(CONNECTION_RUNTIME_STORAGE_KEY);
  } catch {
    // best effort only
  }
}

function encodeBase64(bytes: Uint8Array) {
  let binary = "";
  for (let index = 0; index < bytes.length; index += 1) {
    binary += String.fromCharCode(bytes[index] ?? 0);
  }
  return btoa(binary);
}

function decodeBase64(value: string) {
  const binary = atob(value);
  return Uint8Array.from(binary, (char) => char.charCodeAt(0));
}

export function readStoredBrowserIdentity() {
  if (typeof window === "undefined") {
    return null;
  }

  try {
    const raw = window.localStorage.getItem(BROWSER_IDENTITY_STORAGE_KEY);
    if (raw == null || raw.trim() === "") {
      return null;
    }
    const parsed = JSON.parse(raw) as { private_key_base64?: unknown };
    const privateKeyBase64 = typeof parsed.private_key_base64 === "string" ? parsed.private_key_base64.trim() : "";
    return privateKeyBase64 === "" ? null : privateKeyBase64;
  } catch {
    return null;
  }
}

export function persistStoredBrowserIdentity(privateKeyBase64: string | null) {
  if (typeof window === "undefined") {
    return;
  }

  try {
    const normalized = privateKeyBase64?.trim() ?? "";
    if (normalized === "") {
      window.localStorage.removeItem(BROWSER_IDENTITY_STORAGE_KEY);
      return;
    }
    window.localStorage.setItem(BROWSER_IDENTITY_STORAGE_KEY, JSON.stringify({ private_key_base64: normalized }));
  } catch {
    // best effort only
  }
}

export async function loadOrCreateBrowserPrivateKey() {
  const [{ keys }] = await Promise.all([import("@libp2p/crypto")]);
  const storedKey = readStoredBrowserIdentity();
  if (storedKey != null) {
    try {
      return keys.privateKeyFromProtobuf(decodeBase64(storedKey));
    } catch {
      persistStoredBrowserIdentity(null);
    }
  }

  const privateKey = await keys.generateKeyPair("Ed25519");
  persistStoredBrowserIdentity(encodeBase64(keys.privateKeyToProtobuf(privateKey)));
  return privateKey;
}

export function resolveConnectionEntryTargetAddress(input: string): ResolvedConnectionEntryTarget {
  const trimmed = normalizeBrowserConnectionAddr(input);
  if (trimmed === "") {
    throw new Error("missing connection input");
  }
  if (!trimmed.startsWith("/")) {
    throw new Error("连接地址必须使用完整 auto_connection multiaddr。");
  }
  if (!isBrowserDialableConnectionAddr(trimmed)) {
    throw new Error("连接地址必须是浏览器可拨的 multiaddr（包含 /p2p，且传输为 /webtransport 或 /ws）。");
  }
  return {
    connectionAddr: trimmed,
    transport: hasProtocolSegment(trimmed, "webtransport") ? "webtransport" : "ws",
  };
}
