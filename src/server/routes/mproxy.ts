import { Hono } from "hono";
import { getSupabase } from "mtmsdk/supabase/supabase";
import type { AppContext } from "../types";

export const mproxyRoute = new Hono<AppContext>();

const FETCH_TIMEOUT_MS = 8_000;
const MAX_RESPONSE_BYTES = 1_000_000;
const CONTROL_PLANE_HEADER = "x-gomtm-control-plane";
const CONTROL_PLANE_HEADER_VALUE = "mproxy-subscription-import";
const NO_STORE_HEADERS = {
  "cache-control": "no-store",
  "content-type": "application/json; charset=utf-8",
};

mproxyRoute.post("/mproxy/subscription/fetch", async (c) => {
  if (!isTrustedDashboardRequest(c.req.raw)) {
    return jsonNoStore({ error: "forbidden" }, 403);
  }

  const supabase = getSupabase(c);
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();
  if (authError || !user) {
    return jsonNoStore({ error: "unauthorized" }, 401);
  }

  const payload = await c.req.json().catch(() => null);
  const targetUrl =
    payload && typeof payload === "object" && "url" in payload && typeof payload.url === "string" ? payload.url.trim() : "";
  if (!targetUrl) {
    return jsonNoStore({ error: "url is required" }, 400);
  }

  let parsedUrl: URL;
  try {
    parsedUrl = new URL(targetUrl);
  } catch {
    return jsonNoStore({ error: "url is invalid" }, 400);
  }

  const validationError = validateRemoteUrl(parsedUrl);
  if (validationError) {
    return jsonNoStore({ error: validationError }, 400);
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(new Error("fetch timeout")), FETCH_TIMEOUT_MS);

  try {
    const response = await fetch(parsedUrl, {
      headers: {
        accept: "application/json,text/plain;q=0.9,*/*;q=0.8",
        "user-agent": "gomtmui-mproxy-import/1.0",
      },
      redirect: "manual",
      signal: controller.signal,
    });

    if (isRedirectStatus(response.status) || response.headers.has("location")) {
      return jsonNoStore({ error: "redirects are not allowed" }, 400);
    }

    const actualUrl = response.url ? new URL(response.url) : parsedUrl;
    const actualValidationError = validateRemoteUrl(actualUrl);
    if (actualValidationError) {
      return jsonNoStore({ error: actualValidationError }, 400);
    }

    if (!response.ok) {
      return jsonNoStore({ error: `upstream request failed with status ${response.status}` }, 502);
    }

    const body = await readBoundedText(response, controller.signal);

    return jsonNoStore({ body, contentType: response.headers.get("content-type") });
  } catch (error) {
    const message = controller.signal.aborted ? "fetch timeout" : error instanceof Error ? error.message : String(error);
    return jsonNoStore({ error: message }, 502);
  } finally {
    clearTimeout(timeoutId);
  }
});

function jsonNoStore(payload: unknown, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: NO_STORE_HEADERS,
  });
}

async function readBoundedText(response: Response, signal: AbortSignal) {
  if (!response.body) {
    return "";
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  const chunks: string[] = [];
  let totalBytes = 0;

  while (true) {
    if (signal.aborted) {
      throw new Error("fetch timeout");
    }

    const { done, value } = await reader.read();
    if (done) {
      break;
    }

    totalBytes += value.byteLength;
    if (totalBytes > MAX_RESPONSE_BYTES) {
      throw new Error("response too large");
    }

    chunks.push(decoder.decode(value, { stream: true }));
  }

  chunks.push(decoder.decode());
  return chunks.join("");
}

function isRedirectStatus(status: number) {
  return status >= 300 && status < 400;
}

function isTrustedDashboardRequest(request: Request) {
  if (request.headers.get(CONTROL_PLANE_HEADER) !== CONTROL_PLANE_HEADER_VALUE) {
    return false;
  }

  const requestUrl = new URL(request.url);
  const expectedHost = requestUrl.host;
  const origin = request.headers.get("origin");
  const referer = request.headers.get("referer");
  const secFetchSite = request.headers.get("sec-fetch-site");

  if (origin) {
    try {
      if (new URL(origin).host !== expectedHost) {
        return false;
      }
    } catch {
      return false;
    }
  } else if (referer) {
    try {
      if (new URL(referer).host !== expectedHost) {
        return false;
      }
    } catch {
      return false;
    }
  } else {
    return false;
  }

  if (secFetchSite && secFetchSite !== "same-origin" && secFetchSite !== "same-site") {
    return false;
  }

  return true;
}

function validateRemoteUrl(url: URL) {
  if (url.protocol !== "https:") {
    return "https only";
  }

  if (isPrivateOrLocalHostname(url.hostname)) {
    return "private host blocked";
  }

  return null;
}

function isPrivateOrLocalHostname(hostname: string) {
  const normalized = hostname.trim().toLowerCase().replace(/^\[(.*)\]$/, "$1");
  if (!normalized) {
    return true;
  }

  if (normalized === "localhost" || normalized === "::1" || normalized === "0.0.0.0") {
    return true;
  }

  if (normalized.endsWith(".local")) {
    return true;
  }

  if (
    /^127\./.test(normalized) ||
    /^10\./.test(normalized) ||
    /^192\.168\./.test(normalized) ||
    /^169\.254\./.test(normalized)
  ) {
    return true;
  }

  const match172 = normalized.match(/^172\.(\d{1,3})\./);
  if (match172) {
    const secondOctet = Number(match172[1]);
    if (secondOctet >= 16 && secondOctet <= 31) {
      return true;
    }
  }

  if (/^(fc|fd)[0-9a-f:]+$/i.test(normalized) || /^fe80:/i.test(normalized)) {
    return true;
  }

  return false;
}
