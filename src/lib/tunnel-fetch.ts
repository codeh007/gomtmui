export async function tunnelFetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  const request =
    typeof input === "string" || input instanceof URL
      ? new Request(input, init)
      : init
        ? new Request(input, init)
        : input;
  const targetUrl = request.url;
  const proxyUrl = `/api/cf/fetch?url=${encodeURIComponent(targetUrl)}`;
  return fetch(new Request(proxyUrl, request));
}
