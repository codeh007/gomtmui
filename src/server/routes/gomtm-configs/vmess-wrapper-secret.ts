import { randomBytes } from "node:crypto";
import YAML from "yaml";

type YamlRecord = Record<string, unknown>;
const envPlaceholderPattern = /^\$\{env\.[A-Za-z0-9_]+\}$/;

export class InvalidConfigYamlError extends Error {
  constructor() {
    super("invalid config_yaml");
    this.name = "InvalidConfigYamlError";
  }
}

export class VmessWrapperSecretPlaceholderError extends Error {
  constructor() {
    super("mproxy.entries.vmess.wrapper_secret must be a concrete base64 value; ${env.*} placeholders are not allowed");
    this.name = "VmessWrapperSecretPlaceholderError";
  }
}

function isYamlRecord(value: unknown): value is YamlRecord {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function parseYamlRecord(configYaml: string): YamlRecord | null {
  let document: unknown;
  try {
    document = YAML.parse(configYaml);
  } catch {
    throw new InvalidConfigYamlError();
  }

  if (!isYamlRecord(document)) {
    return null;
  }

  return document;
}

function resolveVmessWrapperRecord(document: YamlRecord) {
  const mproxy = document.mproxy;
  if (!isYamlRecord(mproxy)) {
    return null;
  }

  const entries = mproxy.entries;
  if (!isYamlRecord(entries)) {
    return null;
  }

  const vmess = entries.vmess;
  if (!isYamlRecord(vmess) || vmess.enable !== true) {
    return null;
  }

  return vmess;
}

function readConcreteWrapperSecret(document: YamlRecord) {
  const vmess = resolveVmessWrapperRecord(document);
  if (!vmess || typeof vmess.wrapper_secret !== "string") {
    return null;
  }

  const secret = vmess.wrapper_secret.trim();
  if (!secret) {
    return null;
  }
  if (envPlaceholderPattern.test(secret)) {
    throw new VmessWrapperSecretPlaceholderError();
  }

  return secret;
}

export function ensureVmessWrapperSecret(
  configYaml: string,
  randomSource: () => Uint8Array = () => randomBytes(32),
): string {
  const document = parseYamlRecord(configYaml);
  if (!document) {
    return configYaml;
  }

  const vmess = resolveVmessWrapperRecord(document);
  if (!vmess) {
    return configYaml;
  }

  if (readConcreteWrapperSecret(document)) {
    return configYaml;
  }

  vmess.wrapper_secret = Buffer.from(randomSource()).toString("base64");
  return YAML.stringify(document);
}

export function preserveStoredVmessWrapperSecret(configYaml: string, storedConfigYaml: string) {
  const nextDocument = parseYamlRecord(configYaml);
  if (!nextDocument) {
    return configYaml;
  }

  const nextVmess = resolveVmessWrapperRecord(nextDocument);
  if (!nextVmess) {
    return configYaml;
  }

  const storedDocument = parseYamlRecord(storedConfigYaml);
  if (!storedDocument) {
    return configYaml;
  }

  const storedSecret = readConcreteWrapperSecret(storedDocument);
  if (!storedSecret) {
    return configYaml;
  }

  nextVmess.wrapper_secret = storedSecret;
  return YAML.stringify(nextDocument);
}
