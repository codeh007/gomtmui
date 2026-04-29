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

export function ensureVmessWrapperSecret(
  configYaml: string,
  randomSource: () => Uint8Array = () => randomBytes(32),
): string {
  let document: unknown;
  try {
    document = YAML.parse(configYaml);
  } catch {
    throw new InvalidConfigYamlError();
  }

  if (!isYamlRecord(document)) {
    return configYaml;
  }

  const mproxy = document.mproxy;
  if (!isYamlRecord(mproxy)) {
    return configYaml;
  }

  const entries = mproxy.entries;
  if (!isYamlRecord(entries)) {
    return configYaml;
  }

  const vmess = entries.vmess;
  if (!isYamlRecord(vmess) || vmess.enable !== true) {
    return configYaml;
  }

  if (typeof vmess.wrapper_secret === "string" && vmess.wrapper_secret.trim() !== "") {
    if (envPlaceholderPattern.test(vmess.wrapper_secret.trim())) {
      throw new VmessWrapperSecretPlaceholderError();
    }

    return configYaml;
  }

  vmess.wrapper_secret = Buffer.from(randomSource()).toString("base64");
  return YAML.stringify(document);
}
