import { SCRCPY_SERVER_VERSION, resolveUpstreamScrcpyServerURL } from "../../../../lib/p2p/android-scrcpy-asset";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const version = url.searchParams.get("v")?.trim() || SCRCPY_SERVER_VERSION;
  const upstream = await fetch(resolveUpstreamScrcpyServerURL(version), {
    redirect: "follow",
  });
  if (!upstream.ok || upstream.body == null) {
    return new Response(`failed to fetch upstream scrcpy server: ${upstream.status}`, {
      status: 502,
    });
  }
  const headers = new Headers();
  const contentType = upstream.headers.get("content-type")?.trim() || "application/octet-stream";
  headers.set("content-type", contentType);
  headers.set("cache-control", "public, max-age=86400, s-maxage=86400");
  return new Response(upstream.body, {
    headers,
    status: 200,
  });
}

export { resolveUpstreamScrcpyServerURL };
