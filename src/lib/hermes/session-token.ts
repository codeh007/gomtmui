const TOKEN_RE = /window\.__HERMES_SESSION_TOKEN__\s*=\s*"([^"]+)"/;

function getGomtmServerUrl() {
  const configuredUrl = process.env.GOMTM_SERVER_URL?.trim() || process.env.NEXT_PUBLIC_GOMTM_SERVER_URL?.trim();
  if (!configuredUrl) {
    throw new Error("missing GOMTM_SERVER_URL or NEXT_PUBLIC_GOMTM_SERVER_URL for Hermes session token requests");
  }
  return configuredUrl.replace(/\/$/, "");
}

export function extractHermesSessionToken(html: string): string | null {
  const match = html.match(TOKEN_RE);
  return match?.[1] ?? null;
}

export async function loadHermesSessionToken(): Promise<string | null> {
  const response = await fetch(`${getGomtmServerUrl()}/api/hermes`, {
    cache: "no-store",
    headers: {
      accept: "text/html",
    },
  });

  if (!response.ok) {
    throw new Error(`failed to load Hermes dashboard HTML: ${response.status} ${response.statusText}`);
  }

  const html = await response.text();
  return extractHermesSessionToken(html);
}
