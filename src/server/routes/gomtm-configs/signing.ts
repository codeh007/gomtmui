import { createHmac, timingSafeEqual } from "node:crypto";

export const GOMTM_RUNTIME_CONFIG_SIGNING_SECRET_ENV = "GOMTM_RUNTIME_CONFIG_SIGNING_SECRET";

export function signRuntimeConfigPath(input: { basePath: string; expiresAt: number; secret: string }) {
  const payload = `${input.basePath}:${input.expiresAt}`;
  const signature = createHmac("sha256", input.secret).update(payload).digest("hex");
  return { expiresAt: input.expiresAt, signature };
}

export function verifyRuntimeConfigSignature(input: {
  basePath: string;
  expiresAt: number;
  signature: string;
  secret: string;
  now: number;
}) {
  if (!input.signature || input.now > input.expiresAt) {
    return false;
  }

  const expected = signRuntimeConfigPath({
    basePath: input.basePath,
    expiresAt: input.expiresAt,
    secret: input.secret,
  }).signature;

  const expectedBytes = Buffer.from(expected, "utf8");
  const actualBytes = Buffer.from(input.signature, "utf8");

  return expectedBytes.length === actualBytes.length && timingSafeEqual(expectedBytes, actualBytes);
}
