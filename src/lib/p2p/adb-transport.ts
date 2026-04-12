import type { AdbDaemonConnection, AdbPacketData, AdbPacketInit, AdbServerClient } from "@yume-chan/adb";
import { AdbPacket, AdbPacketHeader, AdbReverseNotSupportedError } from "@yume-chan/adb";
import type { MaybeConsumable } from "@yume-chan/stream-extra";
import { Consumable, ReadableStream, WritableStream } from "@yume-chan/stream-extra";
import { ExactReadableEndedError, StructEmptyError, StructNotEnoughDataError } from "@yume-chan/struct";
import {
  type BrowserNodeLike,
  type BrowserProtocolStream,
  openStreamForAddress,
  readJsonFrame,
  writeJsonRequest,
} from "./libp2p-stream";

const STREAM_PROTOCOL = "/gomtm/worker-sb/stream/1.0.0";

type RecordShape = Record<string, unknown>;

type StreamOpenChannel = {
  kind: string;
  framing: string;
  protocolHint: string;
};

export type AdbResourceRef = {
  kind: string;
  resourceId: string;
  leaseId: string;
  resourceGeneration: number;
};

export type OpenAdbTransportParams = {
  address: string;
  node: BrowserNodeLike;
  peerId: string;
  resource: AdbResourceRef;
};

export type OpenAdbTransportResult = {
  stream: BrowserProtocolStream;
  source: AsyncIterable<Uint8Array>;
  close: () => Promise<void>;
  send: (payload: Uint8Array) => Promise<void>;
  throwIfReverseRequested: () => never;
};

function isIgnorableReadableStreamCloseError(error: unknown) {
  if (!(error instanceof Error)) {
    return false;
  }
  const message = error.message.trim().toLowerCase();
  return message.includes("errored readable stream") || message.includes("closed readable stream");
}

export function closeReadableControllerSafely(controller: { close: () => void }) {
  try {
    controller.close();
  } catch (error) {
    if (isIgnorableReadableStreamCloseError(error)) {
      return;
    }
    throw error;
  }
}

export function isIgnorableWritableStreamSendError(error: unknown) {
  if (!(error instanceof Error)) {
    return false;
  }
  const message = error.message.trim().toLowerCase();
  return (
    message.includes("stream is closing") ||
    message.includes("cannot write to a stream that is closing") ||
    message.includes("stream is closed") ||
    message.includes("cannot write to a stream that is closed")
  );
}

function asRecord(value: unknown) {
  return value !== null && typeof value === "object" ? (value as RecordShape) : null;
}

function asString(value: unknown) {
  return typeof value === "string" ? value : "";
}

function parseStreamOpenResponse(value: unknown) {
  const record = asRecord(value);
  if (record == null) {
    throw new Error("invalid stream.open response");
  }
  const payload = asRecord(record.payload);
  if (payload == null) {
    throw new Error("invalid stream.open payload");
  }
  const errorRecord = asRecord(payload.error);
  const channelRecord = asRecord(payload.channel);

  return {
    ok: payload.ok === true,
    channel:
      channelRecord == null
        ? null
        : {
            kind: asString(channelRecord.kind).trim(),
            framing: asString(channelRecord.framing).trim(),
            protocolHint: asString(channelRecord.protocol_hint).trim(),
          },
    error:
      errorRecord == null
        ? null
        : {
            code: asString(errorRecord.code).trim(),
            message: asString(errorRecord.message).trim(),
          },
  };
}

function validateAdbStreamChannel(channel: StreamOpenChannel | null) {
  if (channel == null) {
    return;
  }
  if (channel.kind !== "" && channel.kind !== "raw_duplex_bytes") {
    throw new Error(`unsupported stream channel kind: ${channel.kind}`);
  }
  if (channel.framing !== "" && channel.framing !== "none") {
    throw new Error(`unsupported stream channel framing: ${channel.framing}`);
  }
  if (channel.protocolHint !== "" && channel.protocolHint !== "adb") {
    throw new Error(`unsupported stream channel protocol_hint: ${channel.protocolHint}`);
  }
}

function createPromiseSignals<T>() {
  let settled = false;
  let resolveRef: ((value: T | PromiseLike<T>) => void) | null = null;
  let rejectRef: ((reason?: unknown) => void) | null = null;
  const promise = new Promise<T>((resolve, reject) => {
    resolveRef = resolve;
    rejectRef = reject;
  });

  return {
    promise,
    resolve(value: T) {
      if (settled) {
        return;
      }
      settled = true;
      resolveRef?.(value);
    },
    reject(reason?: unknown) {
      if (settled) {
        return;
      }
      settled = true;
      rejectRef?.(reason);
    },
  };
}

async function consumeMaybeConsumable(chunk: MaybeConsumable<Uint8Array>) {
  if (chunk instanceof Consumable) {
    return chunk.tryConsume((value) => value);
  }
  return chunk;
}

async function sendRawBytes(transport: OpenAdbTransportResult, payload: Uint8Array) {
  await transport.send(payload);
}

function createAsyncExactReadable(source: AsyncIterable<Uint8Array>) {
  const iterator = source[Symbol.asyncIterator]();
  let buffered = new Uint8Array(0);
  let offset = 0;

  return {
    position: 0,
    async readExactly(length: number) {
      while (buffered.length - offset < length) {
        const next = await iterator.next();
        if (next.done) {
          throw new ExactReadableEndedError();
        }
        const nextChunk = next.value;
        const remaining = buffered.subarray(offset);
        const merged = new Uint8Array(remaining.length + nextChunk.length);
        merged.set(remaining, 0);
        merged.set(nextChunk, remaining.length);
        buffered = merged;
        offset = 0;
      }

      const result = buffered.subarray(offset, offset + length);
      offset += length;
      this.position += length;
      if (offset >= buffered.length) {
        buffered = new Uint8Array(0);
        offset = 0;
      }
      return result;
    },
  };
}

export function createAdbServerConnection(transport: OpenAdbTransportResult): AdbServerClient.ServerConnection {
  const closed = createPromiseSignals<undefined>();
  void closed.promise.catch(() => undefined);
  let closedRequested = false;

  const close = async (): Promise<undefined> => {
    if (closedRequested) {
      return undefined;
    }
    closedRequested = true;
    await transport.close().catch(() => undefined);
    closed.resolve(undefined);
    return undefined;
  };

  const readable = new ReadableStream<Uint8Array>({
    start(controller) {
      (async () => {
        try {
          for await (const chunk of transport.source) {
            controller.enqueue(chunk);
          }
          closeReadableControllerSafely(controller);
          closed.resolve(undefined);
        } catch (error) {
          controller.error(error);
          closed.reject(error);
        }
      })();
    },
    cancel() {
      return close();
    },
  });

  const writable = new WritableStream<MaybeConsumable<Uint8Array>>({
    async write(chunk) {
      const payload = await consumeMaybeConsumable(chunk);
      await transport.send(payload);
    },
    close,
    abort(reason) {
      closed.reject(reason);
      return close();
    },
  });

  return {
    readable,
    writable,
    close,
    closed: closed.promise,
  };
}

export function createAdbDaemonConnection(transport: OpenAdbTransportResult): AdbDaemonConnection {
  const closed = createPromiseSignals<undefined>();
  void closed.promise.catch(() => undefined);
  let closedRequested = false;

  const close = async (): Promise<undefined> => {
    if (closedRequested) {
      return undefined;
    }
    closedRequested = true;
    await transport.close().catch(() => undefined);
    closed.resolve(undefined);
    return undefined;
  };

  const readable = new ReadableStream<AdbPacketData>({
    start(controller) {
      (async () => {
        const reader = createAsyncExactReadable(transport.source);
        try {
          while (true) {
            const packet = await AdbPacket.deserialize(reader);
            controller.enqueue(packet);
          }
        } catch (error) {
          if (error instanceof StructEmptyError) {
            closeReadableControllerSafely(controller);
            closed.resolve(undefined);
            return;
          }
          if (error instanceof StructNotEnoughDataError || error instanceof ExactReadableEndedError) {
            const wrapped = new Error("unexpected end of stream while reading adb daemon packet");
            controller.error(wrapped);
            closed.reject(wrapped);
            return;
          }
          controller.error(error);
          closed.reject(error);
        }
      })();
    },
    cancel() {
      return close();
    },
  });

  const writable = new WritableStream<Consumable<AdbPacketInit>>({
    async write(chunk) {
      await chunk.tryConsume(async (packet) => {
        const payloadLength = packet.payload.length;
        const header = new Uint8Array(AdbPacketHeader.size);
        AdbPacketHeader.serialize(
          {
            ...packet,
            payloadLength,
          },
          header,
        );
        await sendRawBytes(transport, header);
        if (payloadLength > 0) {
          await sendRawBytes(transport, packet.payload);
        }
      });
    },
    close,
    abort(reason) {
      closed.reject(reason);
      return close();
    },
  });

  return {
    readable,
    writable,
  };
}

export async function openAdbTransport(params: OpenAdbTransportParams): Promise<OpenAdbTransportResult> {
  const stream = await openStreamForAddress({
    node: params.node,
    address: params.address,
    freshConnection: true,
    protocol: STREAM_PROTOCOL,
  });
  let closed = false;

  await writeJsonRequest(stream, {
    v: 1,
    op: "stream.open.req",
    request_id: `adb-stream-open-${params.peerId}-${Date.now()}`,
    timeout_ms: 10_000,
    payload: {
      target: {
        kind: params.resource.kind,
        resource_id: params.resource.resourceId,
        lease_id: params.resource.leaseId,
        resource_generation: params.resource.resourceGeneration,
      },
    },
  });

  const response = await readJsonFrame(stream);
  const parsed = parseStreamOpenResponse(response.payload);
  if (!parsed.ok) {
    await stream.close().catch(() => undefined);
    throw new Error(parsed.error?.message || "stream.open failed");
  }
  validateAdbStreamChannel(parsed.channel);

  const close = async () => {
    if (closed) {
      return;
    }
    closed = true;
    await stream.close().catch(() => undefined);
  };

  const send = async (payload: Uint8Array) => {
    if (closed) {
      return;
    }
    try {
      const sendOK = stream.send(payload);
      if (!sendOK && !closed) {
        await stream.onDrain();
      }
    } catch (error) {
      if (closed || isIgnorableWritableStreamSendError(error)) {
        closed = true;
        return;
      }
      throw error;
    }
  };

  return {
    stream,
    source: response.remainingSource,
    close,
    send,
    throwIfReverseRequested: () => {
      throw new AdbReverseNotSupportedError();
    },
  };
}
