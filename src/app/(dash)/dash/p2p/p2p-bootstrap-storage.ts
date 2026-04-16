const BOOTSTRAP_STORAGE_KEY = "gomtm:p2p:bootstrap-target";
const BROWSER_IDENTITY_STORAGE_KEY = "gomtm:p2p:browser-identity-v1";

type StoredBootstrapTarget = {
  bootstrapAddr?: string;
};

type StoredBootstrapTargetLegacyShape = {
  bootstrap_addr?: unknown;
  bootstrapAddr?: unknown;
};

export type ResolvedBootstrapTarget = {
  bootstrapAddr: string;
};

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
    if (raw != null) {
      const parsed = JSON.parse(raw) as StoredBootstrapTargetLegacyShape;
      const rawBootstrapAddr =
        typeof parsed.bootstrapAddr === "string"
          ? parsed.bootstrapAddr
          : typeof parsed.bootstrap_addr === "string"
            ? parsed.bootstrap_addr
            : "";
      const bootstrapAddr = normalizeBrowserBootstrapAddr(rawBootstrapAddr);
      return bootstrapAddr === "" ? {} : { bootstrapAddr };
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
    if ((target.bootstrapAddr?.trim() ?? "") === "") {
      window.localStorage.removeItem(BOOTSTRAP_STORAGE_KEY);
      return;
    }

    window.localStorage.setItem(BOOTSTRAP_STORAGE_KEY, JSON.stringify({ bootstrapAddr: target.bootstrapAddr }));
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
  if (!trimmed.includes("/webtransport") || !trimmed.includes("/p2p/")) {
    throw new Error("bootstrap 地址必须是浏览器可拨的 WebTransport multiaddr（包含 /webtransport 与 /p2p）。");
  }
  return { bootstrapAddr: trimmed };
}
