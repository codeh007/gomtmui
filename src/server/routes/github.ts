import { Hono } from "hono";
import { configuredCorsMiddleware } from "../middlewares/corsMiddleware";
import type { AppContext } from "../types";

const githubRoute = new Hono<AppContext>();

githubRoute.post("/sign-jwt", configuredCorsMiddleware(), async (c) => {
  const { private_key, signing_input } = await c.req.json().catch(() => ({}));

  if (typeof private_key !== "string" || !private_key || typeof signing_input !== "string" || !signing_input) {
    return c.json({ error: "Missing required parameters: private_key and signing_input" }, 400);
  }

  try {
    const signature = await rsaSign(signing_input, private_key);
    return c.json({ signature });
  } catch (err: any) {
    console.error("[github/sign-jwt] Error:", err.message);
    return c.json({ error: "Failed to sign JWT", details: err.message }, 500);
  }
});

/**
 * 使用 Web Crypto API 进行 RSA-SHA256 签名
 * 支持 PKCS#1 (BEGIN RSA PRIVATE KEY) 和 PKCS#8 (BEGIN PRIVATE KEY) 两种格式
 */
async function rsaSign(message: string, privateKeyPem: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(message);

  // 提取 PEM 中的 base64 内容
  // 注意：必须先 TRIM 再移除换行符，因为 TRIM 只移除前后空格，不移除中间的换行符
  const pemContents = privateKeyPem
    .trim()
    .replace(/-----BEGIN (RSA )?PRIVATE KEY-----/, "")
    .replace(/-----END (RSA )?PRIVATE KEY-----/, "")
    .replace(/\s/g, "");

  const binaryKey = Uint8Array.from(atob(pemContents), (c) => c.charCodeAt(0));

  // 检查是否需要转换：如果是 PKCS#1 格式，需要转换为 PKCS#8
  let keyData: Uint8Array;
  if (isPKCS1Format(binaryKey)) {
    keyData = convertPKCS1ToPKCS8(binaryKey);
  } else {
    keyData = binaryKey;
  }

  const cryptoKey = await crypto.subtle.importKey(
    "pkcs8",
    keyData as BufferSource,
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
    false,
    ["sign"],
  );

  const signature = await crypto.subtle.sign({ name: "RSASSA-PKCS1-v1_5" }, cryptoKey, data);

  return btoa(String.fromCharCode(...new Uint8Array(signature)));
}

/**
 * 检查是否是 PKCS#1 格式
 * 启发式方法：跳过外层 SEQUENCE 和长度编码后，检查第二个元素是否是 INTEGER（PKCS#1）或 SEQUENCE（PKCS#8）
 */
function isPKCS1Format(keyBytes: Uint8Array): boolean {
  // 跳过外层 SEQUENCE 标签和长度编码
  let offset = 1;

  // 处理长度编码
  if (keyBytes[offset] & 0x80) {
    const lengthBytes = keyBytes[offset] & 0x7f;
    offset += 1 + lengthBytes;
  } else {
    offset += 1;
  }

  // 现在 offset 指向内容的第一个元素（version INTEGER）
  // 跳过第一个 INTEGER (version)
  if (keyBytes[offset] === 0x02) {
    offset += 1;

    // 处理长度
    const intLength = keyBytes[offset];
    if (intLength & 0x80) {
      const lengthBytes = intLength & 0x7f;
      offset += 1 + lengthBytes;
    } else {
      offset += 1;
    }

    // 跳过 INTEGER 的内容
    offset += intLength & 0x7f;

    // 现在检查第二个元素
    // PKCS#1: INTEGER (modulus)
    // PKCS#8: SEQUENCE (algorithm identifier)
    return keyBytes[offset] === 0x02;
  }

  return false;
}

/**
 * 将 PKCS#1 格式的 RSA 私钥转换为 PKCS#8 格式
 */
function convertPKCS1ToPKCS8(pkcs1Bytes: Uint8Array): Uint8Array {
  // RSA OID: 1.2.840.113549.1.1.1
  const rsaOid = [0x06, 0x09, 0x2a, 0x86, 0x48, 0x86, 0xf7, 0x0d, 0x01, 0x01, 0x01];

  // 算法标识符: SEQUENCE { OID, NULL }
  const algorithmId = [0x30, 0x0d, ...rsaOid, 0x05, 0x00];

  // 版本号: INTEGER 0
  const version = [0x02, 0x01, 0x00];

  // OCTET STRING 包装 PKCS#1 内容
  const octetStringLength = encodeLength(pkcs1Bytes.length);
  const content = [...version, ...algorithmId, 0x04, ...octetStringLength, ...Array.from(pkcs1Bytes)];

  // 外层 SEQUENCE
  const sequenceLength = encodeLength(content.length);
  return new Uint8Array([0x30, ...sequenceLength, ...content]);
}

/**
 * 编码 ASN.1 长度字段
 */
function encodeLength(length: number): number[] {
  if (length < 128) {
    return [length];
  }

  const bytes: number[] = [];
  let len = length;
  while (len > 0) {
    bytes.unshift(len & 0xff);
    len >>= 8;
  }

  return [0x80 | bytes.length, ...bytes];
}

export { githubRoute };
