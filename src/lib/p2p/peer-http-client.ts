import { chunkToUint8Array, openStreamForAddress, type BrowserNodeLike, type BrowserProtocolStream } from "./libp2p-stream";

const PEER_HTTP_PROTOCOL = "/gomtm/http/1.0.0";

type PeerHTTPRequestStream = Pick<BrowserProtocolStream, "onDrain" | "send">;
type PeerHTTPStreamChunk = Uint8Array | { subarray: (start?: number, end?: number) => Uint8Array };

export class PeerHTTPRequestError extends Error {
  retryable?: boolean;
  status?: number;

  constructor(message: string, options: { retryable?: boolean; status?: number } = {}) {
    super(message);
    this.name = "PeerHTTPRequestError";
    this.retryable = typeof options.retryable === "boolean" ? options.retryable : undefined;
    this.status = typeof options.status === "number" ? options.status : undefined;
    Object.setPrototypeOf(this, PeerHTTPRequestError.prototype);
  }
}

export async function writePeerHTTPRequest(
  stream: PeerHTTPRequestStream,
  input: { body?: string; method: string; path: string },
) {
  const body = input.body ?? "";
  const contentHeaders =
    body === ""
      ? ""
      : `Content-Type: application/json\r\nContent-Length: ${new TextEncoder().encode(body).byteLength}\r\n`;
  const raw = `${input.method} ${input.path} HTTP/1.1\r\nHost: peer-http\r\nConnection: close\r\n${contentHeaders}\r\n${body}`;
  const ok = stream.send(new TextEncoder().encode(raw));
  if (!ok) {
    await stream.onDrain();
  }
}

async function readPeerHTTPResponse(stream: AsyncIterable<PeerHTTPStreamChunk>) {
  const decoder = new TextDecoder();
  let raw = "";

  for await (const chunk of stream) {
    raw += decoder.decode(chunkToUint8Array(chunk), { stream: true });
  }
  raw += decoder.decode();

  const separatorIndex = raw.indexOf("\r\n\r\n");
  if (separatorIndex < 0) {
    throw new Error("invalid peer http response");
  }

  const headerText = raw.slice(0, separatorIndex);
  const body = raw.slice(separatorIndex + 4).trim();
  const statusLine = headerText.split("\r\n", 1)[0] ?? "";
  const statusMatch = statusLine.match(/^HTTP\/\d+\.\d+\s+(\d{3})\b/);
  if (statusMatch == null) {
    throw new Error("invalid peer http status line");
  }

  return {
    body,
    status: Number.parseInt(statusMatch[1] ?? "0", 10),
  };
}

export async function readJsonPeerHTTP(stream: AsyncIterable<PeerHTTPStreamChunk>) {
  const response = await readPeerHTTPResponse(stream);
  return JSON.parse(response.body);
}

export async function requestPeerHTTP(params: {
  address: string;
  body?: string;
  method: string;
  node: BrowserNodeLike;
  path: string;
}) {
  const stream = await openStreamForAddress({
    address: params.address,
    freshConnection: true,
    node: params.node,
    protocol: PEER_HTTP_PROTOCOL,
  });

  try {
    await writePeerHTTPRequest(stream, {
      body: params.body,
      method: params.method,
      path: params.path,
    });
    const response = await readPeerHTTPResponse(stream);
    const payload = response.body === "" ? null : JSON.parse(response.body);

    if (response.status < 200 || response.status >= 300) {
      const message =
        payload != null && typeof payload === "object" && typeof (payload as { message?: unknown }).message === "string"
          ? ((payload as { message: string }).message.trim() || `peer http request failed with status ${response.status}`)
          : `peer http request failed with status ${response.status}`;
      throw new PeerHTTPRequestError(message, {
        retryable: response.status === 429 || response.status === 503,
        status: response.status,
      });
    }

    return payload;
  } finally {
    await stream.close().catch(() => undefined);
  }
}
