import type { BrowserProtocolStream } from "./libp2p-stream";

export type Libp2pRfbChannelInit = {
  hostHeader?: string;
  protocol?: string;
  requestPath?: string;
  source?: AsyncIterable<Uint8Array>;
  stream: Pick<BrowserProtocolStream, "send" | "close" | "onDrain"> &
    Partial<Pick<BrowserProtocolStream, typeof Symbol.asyncIterator>>;
};

const DEFAULT_HOST_HEADER = "127.0.0.1:8444";
const DEFAULT_ORIGIN = `http://${DEFAULT_HOST_HEADER}`;
const DEFAULT_REQUEST_PATH = "/websockify";
const HTTP_HEADERS_TERMINATOR = new Uint8Array([13, 10, 13, 10]);

function concatUint8Arrays(left: Uint8Array, right: Uint8Array) {
  const merged = new Uint8Array(left.length + right.length);
  merged.set(left, 0);
  merged.set(right, left.length);
  return merged;
}

function getRequiredByte(bytes: Uint8Array, index: number) {
  const value = bytes[index];
  if (value == null) {
    throw new Error(`missing byte at index ${index}`);
  }
  return value;
}

function cloneArrayBuffer(bytes: Uint8Array) {
  return Uint8Array.from(bytes).buffer;
}

function indexOfBytes(buffer: Uint8Array, needle: Uint8Array) {
  if (buffer.length < needle.length || needle.length === 0) {
    return -1;
  }
  outer: for (let index = 0; index <= buffer.length - needle.length; index += 1) {
    for (let offset = 0; offset < needle.length; offset += 1) {
      if (buffer[index + offset] !== needle[offset]) {
        continue outer;
      }
    }
    return index;
  }
  return -1;
}

function encodeClientWebSocketFrame(payload: Uint8Array, opcode: number) {
  const payloadLength = payload.byteLength;
  const extendedLengthBytes = payloadLength < 126 ? 0 : payloadLength <= 0xffff ? 2 : 8;
  const framed = new Uint8Array(2 + extendedLengthBytes + 4 + payloadLength);
  const mask = new Uint8Array(4);
  globalThis.crypto.getRandomValues(mask);

  let cursor = 0;
  framed[cursor++] = 0x80 | (opcode & 0x0f);
  if (payloadLength < 126) {
    framed[cursor++] = 0x80 | payloadLength;
  } else if (payloadLength <= 0xffff) {
    framed[cursor++] = 0x80 | 126;
    new DataView(framed.buffer).setUint16(cursor, payloadLength);
    cursor += 2;
  } else {
    framed[cursor++] = 0x80 | 127;
    new DataView(framed.buffer).setBigUint64(cursor, BigInt(payloadLength));
    cursor += 8;
  }
  framed.set(mask, cursor);
  cursor += 4;
  for (let index = 0; index < payloadLength; index += 1) {
    framed[cursor + index] = getRequiredByte(payload, index) ^ getRequiredByte(mask, index % 4);
  }
  return framed;
}

type ParsedWebSocketFrame = {
  fin: boolean;
  opcode: number;
  payload: Uint8Array;
  rest: Uint8Array;
};

function parseWebSocketFrame(buffer: Uint8Array): ParsedWebSocketFrame | null {
  if (buffer.length < 2) {
    return null;
  }

  const first = getRequiredByte(buffer, 0);
  const second = getRequiredByte(buffer, 1);
  const fin = (first & 0x80) !== 0;
  const opcode = first & 0x0f;
  const masked = (second & 0x80) !== 0;
  let payloadLength = second & 0x7f;
  let cursor = 2;

  if (payloadLength === 126) {
    if (buffer.length < cursor + 2) {
      return null;
    }
    payloadLength = new DataView(buffer.buffer, buffer.byteOffset + cursor, 2).getUint16(0);
    cursor += 2;
  } else if (payloadLength === 127) {
    if (buffer.length < cursor + 8) {
      return null;
    }
    payloadLength = Number(new DataView(buffer.buffer, buffer.byteOffset + cursor, 8).getBigUint64(0));
    cursor += 8;
  }

  let mask: Uint8Array | null = null;
  if (masked) {
    if (buffer.length < cursor + 4) {
      return null;
    }
    mask = buffer.slice(cursor, cursor + 4);
    cursor += 4;
  }

  if (buffer.length < cursor + payloadLength) {
    return null;
  }

  const payload = buffer.slice(cursor, cursor + payloadLength);
  if (mask != null) {
    for (let index = 0; index < payload.length; index += 1) {
      payload[index] = getRequiredByte(payload, index) ^ getRequiredByte(mask, index % 4);
    }
  }

  return {
    fin,
    opcode,
    payload,
    rest: buffer.slice(cursor + payloadLength),
  };
}

export class Libp2pRfbChannel {
  binaryType: BinaryType = "arraybuffer";
  onclose: ((event: CloseEvent) => void) | null = null;
  onerror: ((event: Event) => void) | null = null;
  onopen: (() => void) | null = null;
  protocol: string;
  readyState: "connecting" | "open" | "closing" | "closed" = "connecting";
  readonly ready: Promise<void>;

  #bufferedMessages: ArrayBuffer[] = [];
  #closed = false;
  #closePromise: Promise<void> | null = null;
  #handshakeCompleted = false;
  #hostHeader: string;
  #isReadyResolved = false;
  #onmessage: ((event: MessageEvent<ArrayBuffer>) => void) | null = null;
  #origin: string;
  #requestPath: string;
  #resolveReady: () => void;
  #source: AsyncIterable<Uint8Array>;
  #stream: Libp2pRfbChannelInit["stream"];

  get onmessage() {
    return this.#onmessage;
  }

  set onmessage(handler: ((event: MessageEvent<ArrayBuffer>) => void) | null) {
    this.#onmessage = handler;
    if (handler == null || this.#bufferedMessages.length === 0) {
      return;
    }
    queueMicrotask(() => {
      if (this.#onmessage !== handler || this.#bufferedMessages.length === 0) {
        return;
      }
      for (const data of this.#bufferedMessages.splice(0)) {
        handler(
          new MessageEvent<ArrayBuffer>("message", {
            data,
          }),
        );
      }
    });
  }

  constructor(init: Libp2pRfbChannelInit) {
    this.#hostHeader = init.hostHeader?.trim() || DEFAULT_HOST_HEADER;
    this.#origin = DEFAULT_ORIGIN;
    this.protocol = init.protocol ?? "binary";
    this.#requestPath = init.requestPath?.trim() || DEFAULT_REQUEST_PATH;
    this.#resolveReady = () => {};
    this.#stream = init.stream;
    this.#source = init.source ?? (init.stream as AsyncIterable<Uint8Array> satisfies AsyncIterable<Uint8Array>);
    this.ready = new Promise<void>((resolve) => {
      this.#resolveReady = resolve;
    });
    queueMicrotask(() => {
      void this.#start();
    });
  }

  async close() {
    if (this.#closePromise != null) {
      return this.#closePromise;
    }

    this.readyState = "closing";
    this.#closePromise = (async () => {
      try {
        if (this.#handshakeCompleted) {
          await this.#sendRaw(encodeClientWebSocketFrame(new Uint8Array(0), 0x08)).catch(() => undefined);
        }
        await this.#stream.close();
      } finally {
        this.#emitClose();
      }
    })();
    return this.#closePromise;
  }

  send(data: ArrayBufferView | ArrayBuffer) {
    const payload =
      data instanceof ArrayBuffer
        ? new Uint8Array(data)
        : new Uint8Array(data.buffer, data.byteOffset, data.byteLength);
    void this.#sendRaw(encodeClientWebSocketFrame(payload, 0x02)).catch((error) => {
      this.onerror?.({ type: "error", error } as ErrorEvent);
    });
  }

  async #start() {
    const iterator = this.#source[Symbol.asyncIterator]();
    try {
      let buffered = await this.#performHandshake(iterator);
      if (this.#closed) {
        this.#settleReady();
        return;
      }
      this.#handshakeCompleted = true;
      this.readyState = "open";
      this.onopen?.();
      this.#settleReady();

      while (true) {
        if (this.#closed) {
          return;
        }
        const frame = parseWebSocketFrame(buffered);
        if (frame == null) {
          const next = await iterator.next();
          if (next.done) {
            break;
          }
          buffered = concatUint8Arrays(buffered, next.value);
          continue;
        }
        buffered = frame.rest.slice();

        if (frame.opcode === 0x08) {
          break;
        }
        if (frame.opcode === 0x09) {
          await this.#sendRaw(encodeClientWebSocketFrame(frame.payload, 0x0a));
          continue;
        }
        if (frame.opcode === 0x0a) {
          continue;
        }
        if (frame.opcode === 0x02 || frame.opcode === 0x01) {
          this.#emitMessage(cloneArrayBuffer(frame.payload));
        }
      }
    } catch (error) {
      this.onerror?.({ type: "error", error } as ErrorEvent);
    } finally {
      this.#settleReady();
      this.#emitClose();
    }
  }

  async #performHandshake(iterator: AsyncIterator<Uint8Array>) {
    const websocketKeyBytes = new Uint8Array(16);
    globalThis.crypto.getRandomValues(websocketKeyBytes);
    const upgradeRequest = [
      `GET ${this.#requestPath} HTTP/1.1`,
      `Host: ${this.#hostHeader}`,
      "Upgrade: websocket",
      "Connection: Upgrade",
      `Origin: ${this.#origin}`,
      `Sec-WebSocket-Origin: ${this.#origin}`,
      `Sec-WebSocket-Key: ${btoa(String.fromCharCode(...websocketKeyBytes))}`,
      "Sec-WebSocket-Version: 13",
      `Sec-WebSocket-Protocol: ${this.protocol}`,
      "",
      "",
    ].join("\r\n");
    await this.#sendRaw(new TextEncoder().encode(upgradeRequest));

    let buffered = new Uint8Array(0);
    while (true) {
      const headerEnd = indexOfBytes(buffered, HTTP_HEADERS_TERMINATOR);
      if (headerEnd >= 0) {
        const headersText = new TextDecoder().decode(buffered.slice(0, headerEnd));
        const statusLine = headersText.split("\r\n", 1)[0] ?? "";
        if (!statusLine.includes("101")) {
          throw new Error(`websocket handshake failed: ${statusLine || headersText}`);
        }
        return buffered.slice(headerEnd + HTTP_HEADERS_TERMINATOR.length);
      }

      const next = await iterator.next();
      if (next.done) {
        throw new Error("websocket handshake failed: unexpected end of stream");
      }
      buffered = concatUint8Arrays(buffered, next.value);
    }
  }

  async #sendRaw(payload: Uint8Array) {
    const sendOk = this.#stream.send(payload);
    if (!sendOk) {
      await this.#stream.onDrain();
    }
  }

  #settleReady() {
    if (this.#isReadyResolved) {
      return;
    }
    this.#isReadyResolved = true;
    this.#resolveReady();
  }

  #emitClose() {
    if (this.#closed) {
      return;
    }
    this.#closed = true;
    this.readyState = "closed";
    this.onclose?.({ type: "close", wasClean: true } as CloseEvent);
  }

  #emitMessage(data: ArrayBuffer) {
    if (this.#onmessage == null) {
      this.#bufferedMessages.push(data);
      return;
    }
    this.#onmessage(
      new MessageEvent<ArrayBuffer>("message", {
        data,
      }),
    );
  }
}
