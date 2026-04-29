import { createCipheriv, createHash, randomBytes } from "node:crypto";
import YAML from "yaml";
import { isValidGomtmServerUrl, normalizeGomtmServerUrl } from "@/lib/gomtm-server/url";

const VMESS_WRAPPER_PATH = "/api/mproxy/wsproxy";
const UUID_NAMESPACE_URL = Buffer.from("6ba7b8119dad11d180b400c04fd430c8", "hex");

export function resolveWrapperServerOrigin(candidate: string, fallback: string) {
  const normalizedCandidate = normalizeGomtmServerUrl(candidate || "");
  if (isValidGomtmServerUrl(normalizedCandidate)) {
    return normalizedCandidate;
  }

  const normalizedFallback = normalizeGomtmServerUrl(fallback || "");
  if (isValidGomtmServerUrl(normalizedFallback)) {
    return normalizedFallback;
  }

  throw new Error("valid gomtm server origin is required");
}

export function readWrapperSecretFromConfigYaml(configYaml: string) {
  const document = (YAML.parse(configYaml) ?? {}) as {
    mproxy?: {
      entries?: {
        vmess?: {
          wrapper_secret?: unknown;
        };
      };
    };
  };
  const secret = document.mproxy?.entries?.vmess?.wrapper_secret;
  if (typeof secret !== "string" || secret.trim() === "") {
    throw new Error("vmess wrapper secret is missing from runtime config");
  }

  return secret.trim();
}

export async function buildMproxyVmessWrapperProfile(input: {
  displayName: string;
  nonce?: Uint8Array;
  password: string;
  secretB64: string;
  serverOrigin: string;
  trafficMode: "standard" | "mitm";
  username: string;
}) {
  const key = Buffer.from(input.secretB64, "base64");
  if (key.length !== 32) {
    throw new Error("vmess wrapper secret must decode to 32 bytes");
  }

  const origin = new URL(input.serverOrigin);
  const nonce = input.nonce ? Buffer.from(input.nonce) : randomBytes(12);
  const payload = Buffer.from(`${input.username}\n${input.password}`, "utf8");
  const cipher = createCipheriv("aes-256-gcm", key, nonce);
  cipher.setAAD(Buffer.from(VMESS_WRAPPER_PATH, "utf8"));

  const ciphertext = Buffer.concat([cipher.update(payload), cipher.final(), cipher.getAuthTag()]);
  const token = Buffer.concat([nonce, ciphertext]).toString("base64url");
  const path = `${VMESS_WRAPPER_PATH}/${token}`;

  return {
    add: origin.hostname,
    aid: "0",
    alpn: "",
    fp: "",
    host: origin.host,
    id: deriveWrapperUuid(path),
    net: "ws",
    path,
    port: origin.port || (origin.protocol === "https:" ? "443" : "80"),
    ps: input.trafficMode === "mitm" ? `${input.displayName} [MITM]` : input.displayName,
    scy: "auto",
    sni: origin.hostname,
    tls: origin.protocol === "https:" ? "tls" : "",
    type: "none",
    v: "2",
  };
}

function deriveWrapperUuid(path: string) {
  const hash = createHash("sha1")
    .update(Buffer.concat([UUID_NAMESPACE_URL, Buffer.from(`gomtm:mproxy:vmess:${path}`, "utf8")]))
    .digest();

  hash[6] = (hash[6] & 0x0f) | 0x50;
  hash[8] = (hash[8] & 0x3f) | 0x80;

  const hex = hash.subarray(0, 16).toString("hex");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20, 32)}`;
}
