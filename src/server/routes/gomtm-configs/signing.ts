import { createHmac, timingSafeEqual } from "node:crypto";

export const GOMTM_RUNTIME_CONFIG_SIGNING_SECRET_ENV = "GOMTM_RUNTIME_CONFIG_SIGNING_SECRET";

type RuntimeConfigSigningInput = {
  basePath: string;
  expiresAt: number;
  secret: string;
  version?: string | null;
};

function buildRuntimeConfigSignaturePayload(input: Omit<RuntimeConfigSigningInput, "secret">) {
  return `${input.basePath}:${input.version ?? ""}:${input.expiresAt}`;
}

export function signRuntimeConfigPath(input: RuntimeConfigSigningInput) {
  const payload = buildRuntimeConfigSignaturePayload(input);
  const signature = createHmac("sha256", input.secret).update(payload).digest("hex");
  return { expiresAt: input.expiresAt, signature };
}

export function verifyRuntimeConfigSignature(input: {
  basePath: string;
  expiresAt: number;
  signature: string;
  secret: string;
  now: number;
  version?: string | null;
}) {
  if (!input.signature || input.now > input.expiresAt) {
    return false;
  }

  const expected = signRuntimeConfigPath({
    basePath: input.basePath,
    expiresAt: input.expiresAt,
    secret: input.secret,
    version: input.version,
  }).signature;

  const expectedBytes = Buffer.from(expected, "utf8");
  const actualBytes = Buffer.from(input.signature, "utf8");

  return expectedBytes.length === actualBytes.length && timingSafeEqual(expectedBytes, actualBytes);
}
