export type StreamChunk = { subarray: (start?: number, end?: number) => Uint8Array } | Uint8Array;

export type BrowserProtocolStream = AsyncIterable<StreamChunk> & {
  close: () => Promise<void>;
  onDrain: () => Promise<void>;
  send: (data: Uint8Array) => boolean;
};

type BrowserNewStreamOptions = {
  runOnLimitedConnection?: boolean;
};

export type BrowserNodeLike = {
  dial: (address: any) => Promise<{
    newStream: (protocol: string | string[], options?: BrowserNewStreamOptions) => Promise<BrowserProtocolStream>;
  }>;
  dialProtocol?: (
    address: any,
    protocol: string | string[],
    options?: BrowserNewStreamOptions,
  ) => Promise<BrowserProtocolStream>;
  isDialable?: (address: any) => Promise<boolean>;
};

export type BrowserConnectionPath = "direct" | "relay";

type BrowserDialConnection = Awaited<ReturnType<BrowserNodeLike["dial"]>>;

const circuitConnectionCache = new WeakMap<BrowserNodeLike, Map<string, Promise<BrowserDialConnection>>>();

function isTransientBrowserStreamOpenError(error: unknown) {
  const message = error instanceof Error ? error.message.trim().toLowerCase() : String(error).trim().toLowerCase();
  return (
    message.includes('the connection is "closing" and not "open"') ||
    message.includes('the connection is "closed" and not "open"') ||
    message.includes("cannot write to a stream that is closing") ||
    message.includes("the stream has been reset") ||
    message.includes("stream has been reset")
  );
}

async function openStreamOnFreshConnection(params: { node: BrowserNodeLike; protocol: string; target: any }) {
  const connection = await params.node.dial(params.target);
  return connection.newStream(params.protocol, { runOnLimitedConnection: true });
}

export function chunkToUint8Array(chunk: StreamChunk) {
  return chunk instanceof Uint8Array ? chunk : chunk.subarray();
}

export async function writeJsonRequest(stream: BrowserProtocolStream, payload: unknown) {
  const encoder = new TextEncoder();
  const sendOk = stream.send(encoder.encode(`${JSON.stringify(payload)}\n`));
  if (!sendOk) {
    await stream.onDrain();
  }
}

export async function openStreamForAddress(params: {
  node: BrowserNodeLike;
  address: string;
  protocol: string;
  freshConnection?: boolean;
}) {
  if (!params.address.startsWith("/")) {
    throw new Error(`当前浏览器暂不支持非 multiaddr endpoint: ${params.address}`);
  }

  const { multiaddr } = await import("@multiformats/multiaddr");
  const target = multiaddr(params.address);
  if (params.address.includes("/p2p-circuit/")) {
    if (params.freshConnection === true) {
      return openStreamOnFreshConnection({
        node: params.node,
        protocol: params.protocol,
        target,
      });
    }
    const connection = await getOrCreateCircuitConnection(params.node, params.address, target);
    try {
      return await connection.newStream(params.protocol, { runOnLimitedConnection: true });
    } catch (_error) {
      clearCachedCircuitConnection(params.node, params.address);
      const freshConnection = await getOrCreateCircuitConnection(params.node, params.address, target);
      return await freshConnection.newStream(params.protocol, { runOnLimitedConnection: true });
    }
  }
  if (typeof params.node.dialProtocol === "function") {
    try {
      return await params.node.dialProtocol(target, params.protocol, { runOnLimitedConnection: true });
    } catch (error) {
      if (!isTransientBrowserStreamOpenError(error)) {
        throw error;
      }
      return openStreamOnFreshConnection({
        node: params.node,
        protocol: params.protocol,
        target,
      });
    }
  }
  try {
    return await openStreamOnFreshConnection({
      node: params.node,
      protocol: params.protocol,
      target,
    });
  } catch (error) {
    if (!isTransientBrowserStreamOpenError(error)) {
      throw error;
    }
    return openStreamOnFreshConnection({
      node: params.node,
      protocol: params.protocol,
      target,
    });
  }
}

async function getOrCreateCircuitConnection(node: BrowserNodeLike, address: string, target: any) {
  let perNodeCache = circuitConnectionCache.get(node);
  if (perNodeCache == null) {
    perNodeCache = new Map();
    circuitConnectionCache.set(node, perNodeCache);
  }

  const cached = perNodeCache.get(address);
  if (cached != null) {
    return await cached;
  }

  const pending = node.dial(target).catch((error) => {
    clearCachedCircuitConnection(node, address);
    throw error;
  });
  perNodeCache.set(address, pending);
  return await pending;
}

function clearCachedCircuitConnection(node: BrowserNodeLike, address: string) {
  const perNodeCache = circuitConnectionCache.get(node);
  if (perNodeCache == null) {
    return;
  }
  perNodeCache.delete(address);
  if (perNodeCache.size === 0) {
    circuitConnectionCache.delete(node);
  }
}

export async function pickDialableBrowserAddress(params: { node: BrowserNodeLike; multiaddrs: string[] }) {
  const candidates = orderBrowserAddressCandidates(params.multiaddrs);
  if (typeof params.node.isDialable !== "function") {
    return undefined;
  }

  const { multiaddr } = await import("@multiformats/multiaddr");
  for (const candidate of candidates) {
    try {
      if (await params.node.isDialable(multiaddr(candidate))) {
        return candidate;
      }
    } catch {
      // 某个 multiaddr 被当前 transport 视为不可拨时，继续尝试下一个候选。
    }
  }

  return undefined;
}

export function classifyBrowserConnectionPath(value: string | null | undefined): BrowserConnectionPath | null {
  const normalized = value?.trim() ?? "";
  if (!normalized.startsWith("/")) {
    return null;
  }
  return normalized.includes("/p2p-circuit/") ? "relay" : "direct";
}

export function getPreferredBrowserConnectionPath(multiaddrs: string[]) {
  return classifyBrowserConnectionPath(orderBrowserAddressCandidates(multiaddrs)[0]);
}

export function deriveBrowserRelayAddressFromBootstrap(params: {
  activeBootstrapAddr: string | null | undefined;
  peerId: string;
  multiaddrs: string[];
}) {
  const bootstrapAddr = params.activeBootstrapAddr?.trim() ?? "";
  const peerId = params.peerId.trim();
  if (bootstrapAddr === "" || peerId === "") {
    return null;
  }
  if (!bootstrapAddr.startsWith("/") || !bootstrapAddr.includes("/webtransport") || !bootstrapAddr.includes("/p2p/")) {
    return null;
  }
  return `${bootstrapAddr}/p2p-circuit/p2p/${peerId}`;
}

function orderBrowserAddressCandidates(multiaddrs: string[]) {
  return multiaddrs
    .map((value) => value.trim())
    .filter((value) => value.startsWith("/"))
    .sort((left, right) => browserAddressPreferenceScore(right) - browserAddressPreferenceScore(left));
}

function browserAddressPreferenceScore(value: string) {
  let score = 0;
  const hasCircuit = value.includes("/p2p-circuit/");
  const hasWebTransport = value.includes("/webtransport/");
  const hasTcp = value.includes("/tcp/");

  if (hasWebTransport) {
    score += 100;
  }
  if (!hasCircuit) {
    score += 120;
  }
  if (hasCircuit && hasWebTransport) {
    score += 40;
  }
  if (hasCircuit && hasTcp) {
    score -= 120;
  } else if (hasTcp) {
    score -= 5;
  }
  return score;
}

export async function readJsonFrame(stream: BrowserProtocolStream) {
  const iterator = stream[Symbol.asyncIterator]();
  const decoder = new TextDecoder();
  let buffered = new Uint8Array(0);

  while (true) {
    const newlineIndex = buffered.indexOf(10);
    if (newlineIndex >= 0) {
      const line = buffered.slice(0, newlineIndex);
      const remainder = buffered.slice(newlineIndex + 1);

      async function* remainingSource() {
        if (remainder.length > 0) {
          yield remainder;
        }
        while (true) {
          const next = await iterator.next();
          if (next.done) {
            return;
          }
          yield chunkToUint8Array(next.value);
        }
      }

      const text = decoder.decode(line).trim();
      return {
        payload: JSON.parse(text) as unknown,
        remainingSource: remainingSource(),
      };
    }

    const next = await iterator.next();
    if (next.done) {
      throw new Error("unexpected end of stream while reading json frame");
    }

    const nextChunk = chunkToUint8Array(next.value);
    const merged = new Uint8Array(buffered.length + nextChunk.length);
    merged.set(buffered, 0);
    merged.set(nextChunk, buffered.length);
    buffered = merged;
  }
}
