const BOOTSTRAP_STORAGE_KEY = "gomtm:p2p:bootstrap-target";
const BOOTSTRAP_SERVER_URL_STORAGE_KEY = "gomtm:p2p:bootstrap-server-url";
const BROWSER_IDENTITY_STORAGE_KEY = "gomtm:p2p:browser-identity-v1";

export type StoredBootstrapTarget = {
  bootstrapAddr?: string;
  serverUrl?: string;
};

export type ResolvedBootstrapTarget = {
  bootstrapAddr: string;
  transport: "webtransport" | "ws";
};

function hasProtocolSegment(value: string, protocol: string) {
  return value.split("/").includes(protocol);
}

function isBrowserDialableBootstrapAddr(value: string) {
  if (!hasProtocolSegment(value, "p2p")) {
    return false;
  }

  if (hasProtocolSegment(value, "webtransport")) {
    return true;
  }

  return hasProtocolSegment(value, "ws") && !hasProtocolSegment(value, "tls") && !hasProtocolSegment(value, "wss");
}

export function normalizeBrowserBootstrapAddr(value: string) {
  const trimmed = value.trim();
  if (trimmed === "" || !trimmed.includes("/webtransport") || !trimmed.includes("/certhash/")) {
    return trimmed;
  }

  const segments = trimmed.split("/");
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

export function shouldAllowPrivateBootstrapMultiaddr(candidate: string, bootstrapAddr: string) {
  const normalizedCandidate = normalizeBrowserBootstrapAddr(candidate);
  if (normalizedCandidate === "") {
    return false;
  }
  return normalizedCandidate === normalizeBrowserBootstrapAddr(bootstrapAddr);
}

export function readStoredBootstrapTarget(): StoredBootstrapTarget {
  if (typeof window === "undefined") {
    return {};
  }

  try {
    const raw = window.localStorage.getItem(BOOTSTRAP_STORAGE_KEY);
    const rawServerUrl = window.localStorage.getItem(BOOTSTRAP_SERVER_URL_STORAGE_KEY);
    const serverUrl = rawServerUrl?.trim() ?? "";
    if (raw != null) {
      const parsed = JSON.parse(raw) as StoredBootstrapTarget;
      const rawBootstrapAddr = typeof parsed.bootstrapAddr === "string" ? parsed.bootstrapAddr : "";
      const bootstrapAddr = normalizeBrowserBootstrapAddr(rawBootstrapAddr);
      if (bootstrapAddr !== "" || serverUrl !== "") {
        return {
          ...(bootstrapAddr === "" ? {} : { bootstrapAddr }),
          ...(serverUrl === "" ? {} : { serverUrl }),
        };
      }
      return {};
    }
    if (serverUrl !== "") {
      return { serverUrl };
    }
  } catch {
    // localStorage 不可用时直接回退到运行时默认值
  }

  return {};
}

export function persistStoredBootstrapTarget(target: StoredBootstrapTarget) {
  if (typeof window === "undefined") {
    return;
  }

  try {
    const bootstrapAddr = target.bootstrapAddr?.trim() ?? "";
    const serverUrl = target.serverUrl?.trim() ?? "";
    if (bootstrapAddr === "") {
      window.localStorage.removeItem(BOOTSTRAP_STORAGE_KEY);
    } else {
      window.localStorage.setItem(BOOTSTRAP_STORAGE_KEY, JSON.stringify({ bootstrapAddr }));
    }
    if (serverUrl === "") {
      window.localStorage.removeItem(BOOTSTRAP_SERVER_URL_STORAGE_KEY);
    } else {
      window.localStorage.setItem(BOOTSTRAP_SERVER_URL_STORAGE_KEY, serverUrl);
    }
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

export function resolveBootstrapTarget(input: string): ResolvedBootstrapTarget {
  const trimmed = normalizeBrowserBootstrapAddr(input);
  if (trimmed === "") {
    throw new Error("missing bootstrap input");
  }
  if (!trimmed.startsWith("/")) {
    throw new Error("bootstrap 地址必须使用完整 auto_bootstrap multiaddr。");
  }
  if (!isBrowserDialableBootstrapAddr(trimmed)) {
    throw new Error("bootstrap 地址必须是浏览器可拨的 multiaddr（包含 /p2p，且传输为 /webtransport 或 /ws）。");
  }
  return {
    bootstrapAddr: trimmed,
    transport: hasProtocolSegment(trimmed, "webtransport") ? "webtransport" : "ws",
  };
}
