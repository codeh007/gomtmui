import { PLATFORM_CONFIGS } from "@/lib/cloud-account/platform-configs";
import { Hono } from "hono";
import type { AppContext } from "../types";

export const netProxyRoute = new Hono<AppContext>();

netProxyRoute.all("/fetch", async (c) => {
  if (c.req.method === "OPTIONS") {
    return new Response(null, {
      status: 204,
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, PATCH, OPTIONS",
        "Access-Control-Allow-Headers": "*",
      },
    });
  }

  const targetUrl = c.req.query("url")?.trim();
  if (!targetUrl) {
    return c.json({ error: "Target URL is required" }, 400);
  }

  let parsedUrl: URL;
  try {
    parsedUrl = new URL(targetUrl);
  } catch {
    return c.json({ error: "Target URL is invalid" }, 400);
  }

  if (parsedUrl.protocol !== "https:") {
    return c.json({ error: "Target URL must use https" }, 400);
  }

  if (isBlockedHostname(parsedUrl.hostname) || !allowedProxyHostnames.has(parsedUrl.hostname.toLowerCase())) {
    return c.json({ error: "Target host is not allowed" }, 400);
  }

  try {
    const requestHeaders = copyIncomingHeaders(c.req.raw);
    if (!requestHeaders.has("user-agent")) {
      requestHeaders.set("user-agent", "Mozilla/5.0 (Compatible; GoMtmProxy/1.0)");
    }

    const response = await fetch(parsedUrl, {
      method: c.req.method,
      headers: requestHeaders,
      body: ["GET", "HEAD"].includes(c.req.method) ? undefined : c.req.raw.body,
      redirect: "follow",
    });

    const responseHeaders = new Headers(response.headers);
    responseHeaders.delete("access-control-allow-origin");
    responseHeaders.delete("access-control-allow-credentials");
    responseHeaders.set("Access-Control-Allow-Origin", "*");

    return new Response(response.body, {
      status: response.status,
      statusText: response.statusText,
      headers: responseHeaders,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return c.json({ error: message, type: "ProxyFetchError" }, 502);
  }
});

const excludedHeaderPrefixes = [
  "host",
  "cookie",
  "content-length",
  "x-forwarded-",
  "cf-",
  "connection",
  "sec-",
  "proxy-",
];

const allowedProxyHostnames = new Set<string>(["api.supabase.com"]);

for (const platform of Object.values(PLATFORM_CONFIGS)) {
  const oauth = "oauth" in platform ? platform.oauth : undefined;
  const authUrl = oauth && "authUrl" in oauth ? oauth.authUrl : undefined;
  const tokenUrl = oauth?.tokenUrl;
  const deviceAuthorizationUrl = oauth && "deviceAuthorizationUrl" in oauth ? oauth.deviceAuthorizationUrl : undefined;
  const urls = [platform.baseUrl, authUrl, tokenUrl, deviceAuthorizationUrl];

  for (const value of urls) {
    if (!value) {
      continue;
    }
    allowedProxyHostnames.add(new URL(value).hostname.toLowerCase());
  }
}

function copyIncomingHeaders(request: Request) {
  const headers = new Headers(
    Array.from(request.headers.entries()).filter(
      ([key]) => !excludedHeaderPrefixes.some((prefix) => key.toLowerCase().startsWith(prefix)),
    ),
  );
  headers.set("Accept-Encoding", "gzip, deflate, br");
  return headers;
}

function isBlockedHostname(hostname: string) {
  const normalized = hostname.trim().toLowerCase();
  if (!normalized) {
    return true;
  }

  if (normalized === "localhost" || normalized === "::1") {
    return true;
  }

  if (/^127\./.test(normalized) || /^10\./.test(normalized) || /^192\.168\./.test(normalized)) {
    return true;
  }

  const match172 = normalized.match(/^172\.(\d{1,3})\./);
  if (match172) {
    const secondOctet = Number(match172[1]);
    if (secondOctet >= 16 && secondOctet <= 31) {
      return true;
    }
  }

  return false;
}
