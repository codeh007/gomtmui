import {
  type BrowserNodeLike,
  type BrowserProtocolStream,
  openStreamForAddress,
  readJsonFrame,
  writeJsonRequest,
} from "./libp2p-stream";

export const DIRECT_WEBRTC_SIGNAL_PROTOCOL = "/gomtm/direct-webrtc-signal/1.0.0";
export const DIRECT_REQUEST_DATA_CHANNEL_LABEL = "gomtm-direct-request";
const DEFAULT_CHANNEL_READY_TIMEOUT_MS = 15000;
const DEFAULT_DIRECT_REQUEST_TIMEOUT_MS = 5000;

let nextDirectRequestId = 0;

function createAbortError() {
  if (typeof DOMException === "function") {
    return new DOMException("The operation was aborted", "AbortError");
  }

  const error = new Error("The operation was aborted");
  error.name = "AbortError";
  return error;
}

type DirectSignalAnswerFrame = {
  sdp: string;
  type: "answer";
};

export type AndroidDirectRequestFrame = {
  body?: unknown;
  id?: string;
  method: string;
  path: string;
  signal?: AbortSignal;
};

export type AndroidDirectResponseFrame = {
  body: unknown;
  id: string;
  status: number;
};

type DirectRequestMessageEvent = {
  data: unknown;
};

type DirectRequestDataChannelLike = {
  addEventListener?: (
    type: "close" | "error" | "message" | "open",
    listener: ((event?: DirectRequestMessageEvent) => void) | (() => void),
  ) => void;
  close?: () => void;
  readyState?: string;
  removeEventListener?: (
    type: "close" | "error" | "message" | "open",
    listener: ((event?: DirectRequestMessageEvent) => void) | (() => void),
  ) => void;
  send?: (data: string) => void;
};

type DirectRequestPeerConnectionLike = {
  addEventListener?: (type: "icegatheringstatechange", listener: () => void) => void;
  close: () => void;
  createDataChannel: (label: string) => DirectRequestDataChannelLike;
  createOffer: () => Promise<RTCSessionDescriptionInit>;
  getStats?: () => Promise<RTCStatsReport>;
  iceGatheringState?: string;
  localDescription?: RTCSessionDescriptionInit | null;
  removeEventListener?: (type: "icegatheringstatechange", listener: () => void) => void;
  setLocalDescription: (description: RTCSessionDescriptionInit) => Promise<void>;
  setRemoteDescription: (description: RTCSessionDescriptionInit) => Promise<void>;
};

type DirectRequestClientDeps = {
  channelReadyTimeoutMs: number;
  openStreamForAddress: typeof openStreamForAddress;
  peerConnectionFactory: () => DirectRequestPeerConnectionLike;
  readJsonFrame: typeof readJsonFrame;
  requestTimeoutMs: number;
  writeJsonRequest: typeof writeJsonRequest;
};

export type AndroidDirectReadyChannelSession = {
  channel: DirectRequestDataChannelLike;
  close: () => Promise<void>;
  getStats: () => Promise<RTCStatsReport | Map<string, never>>;
  peerConnection: DirectRequestPeerConnectionLike;
  request: (input: AndroidDirectRequestFrame) => Promise<AndroidDirectResponseFrame>;
  signal: BrowserProtocolStream;
};

export type AndroidDirectConnectInput = {
  address: string;
  node: BrowserNodeLike;
  peerId: string;
  signal?: AbortSignal;
};

function getDefaultDeps(): DirectRequestClientDeps {
  return {
    channelReadyTimeoutMs: DEFAULT_CHANNEL_READY_TIMEOUT_MS,
    openStreamForAddress,
    peerConnectionFactory: () =>
      new RTCPeerConnection({
        iceServers: [{ urls: ["stun:stun.l.google.com:19302"] }],
      }),
    readJsonFrame,
    requestTimeoutMs: DEFAULT_DIRECT_REQUEST_TIMEOUT_MS,
    writeJsonRequest,
  };
}

function createDirectReadyChannelSession(params: {
  channel: DirectRequestDataChannelLike;
  peerConnection: DirectRequestPeerConnectionLike;
  requestTimeoutMs: number;
  signal: BrowserProtocolStream;
}): AndroidDirectReadyChannelSession {
  let closed = false;

  return {
    channel: params.channel,
    async close() {
      if (closed) {
        return;
      }
      closed = true;
      params.channel.close?.();
      await params.signal.close().catch(() => undefined);
      params.peerConnection.close();
    },
    async getStats() {
      if (typeof params.peerConnection.getStats !== "function") {
        return new Map<string, never>();
      }
      return await params.peerConnection.getStats();
    },
    peerConnection: params.peerConnection,
    async request(input) {
      const requestId = input.id?.trim() || createDirectRequestId();
      const payload = {
        body: input.body,
        id: requestId,
        method: input.method,
        path: input.path,
      } satisfies Omit<AndroidDirectRequestFrame, "signal"> & { id: string };

      const operation = waitForDirectResponseFrame({
        channel: params.channel,
        requestId,
        timeoutMs: params.requestTimeoutMs,
      });
      params.channel.send?.(`${JSON.stringify(payload)}\n`);
      return await runAbortable({
        onAbort: () => Promise.resolve(),
        operation,
        signal: input.signal,
      });
    },
    signal: params.signal,
  };
}

function createDirectRequestId() {
  nextDirectRequestId += 1;
  return `gomtm-direct-${nextDirectRequestId}`;
}

function throwIfAborted(signal: AbortSignal | undefined) {
  if (signal?.aborted) {
    throw createAbortError();
  }
}

function runAbortable<T>(params: {
  onAbort: () => Promise<void>;
  operation: Promise<T>;
  signal: AbortSignal | undefined;
}) {
  if (params.signal == null) {
    return params.operation;
  }
  if (params.signal.aborted) {
    return params
      .onAbort()
      .catch(() => undefined)
      .then(() => {
        throw createAbortError();
      });
  }
  const abortSignal = params.signal;

  return new Promise<T>((resolve, reject) => {
    let settled = false;
    let aborting = false;

    const finalize = (callback: () => void) => {
      if (settled) {
        return;
      }
      settled = true;
      abortSignal.removeEventListener("abort", handleAbort);
      callback();
    };

    const handleAbort = () => {
      if (aborting || settled) {
        return;
      }
      aborting = true;
      void params
        .onAbort()
        .catch(() => undefined)
        .finally(() => {
          finalize(() => {
            reject(createAbortError());
          });
        });
    };

    abortSignal.addEventListener("abort", handleAbort, { once: true });
    params.operation.then(
      (value) => {
        if (aborting || abortSignal.aborted) {
          return;
        }
        finalize(() => {
          resolve(value);
        });
      },
      (error) => {
        if (aborting || abortSignal.aborted) {
          return;
        }
        finalize(() => {
          reject(error);
        });
      },
    );
  });
}

function openSignalStreamAbortable(params: {
  operation: Promise<BrowserProtocolStream>;
  signal: AbortSignal | undefined;
}) {
  if (params.signal == null) {
    return params.operation;
  }
  if (params.signal.aborted) {
    return Promise.reject(createAbortError());
  }

  const abortSignal = params.signal;
  return new Promise<BrowserProtocolStream>((resolve, reject) => {
    let settled = false;
    let aborted = false;

    const finalize = (callback: () => void) => {
      if (settled) {
        return;
      }
      settled = true;
      abortSignal.removeEventListener("abort", handleAbort);
      callback();
    };

    const handleAbort = () => {
      aborted = true;
      finalize(() => {
        reject(createAbortError());
      });
    };

    abortSignal.addEventListener("abort", handleAbort, { once: true });
    params.operation.then(
      (stream) => {
        if (aborted || abortSignal.aborted) {
          void stream.close().catch(() => undefined);
          return;
        }
        finalize(() => {
          resolve(stream);
        });
      },
      (error) => {
        if (aborted || abortSignal.aborted) {
          return;
        }
        finalize(() => {
          reject(error);
        });
      },
    );
  });
}

function waitForDataChannelOpen(channel: DirectRequestDataChannelLike, timeoutMs: number) {
  if (channel.readyState === "open") {
    return Promise.resolve();
  }
  if (channel.readyState === "closing" || channel.readyState === "closed") {
    return Promise.reject(new Error("direct data channel closed before opening"));
  }

  return new Promise<void>((resolve, reject) => {
    let settled = false;
    const timeout = setTimeout(() => {
      cleanup();
      reject(new Error("direct data channel did not open in time"));
    }, timeoutMs);

    const cleanup = () => {
      if (settled) {
        return;
      }
      settled = true;
      clearTimeout(timeout);
      channel.removeEventListener?.("open", handleOpen);
      channel.removeEventListener?.("close", handleClose);
      channel.removeEventListener?.("error", handleError);
    };

    const handleOpen = () => {
      cleanup();
      resolve();
    };
    const handleClose = () => {
      cleanup();
      reject(new Error("direct data channel closed before opening"));
    };
    const handleError = () => {
      cleanup();
      reject(new Error("direct data channel errored before opening"));
    };

    channel.addEventListener?.("open", handleOpen);
    channel.addEventListener?.("close", handleClose);
    channel.addEventListener?.("error", handleError);
  });
}

function waitForLocalDescriptionSdp(params: {
  peerConnection: DirectRequestPeerConnectionLike;
  timeoutMs: number;
  fallbackDescription: RTCSessionDescriptionInit;
}) {
  const currentDescription = params.peerConnection.localDescription;
  if (typeof currentDescription?.sdp === "string" && currentDescription.sdp.trim() !== "") {
    return Promise.resolve(currentDescription.sdp);
  }
  if (
    typeof params.peerConnection.addEventListener !== "function" ||
    typeof params.peerConnection.removeEventListener !== "function" ||
    params.peerConnection.iceGatheringState == null
  ) {
    return Promise.resolve(params.fallbackDescription.sdp ?? "");
  }
  if (params.peerConnection.iceGatheringState === "complete") {
    return Promise.resolve(params.peerConnection.localDescription?.sdp ?? params.fallbackDescription.sdp ?? "");
  }

  return new Promise<string>((resolve) => {
    let settled = false;
    const timeout = setTimeout(() => {
      cleanup();
      resolve(params.peerConnection.localDescription?.sdp ?? params.fallbackDescription.sdp ?? "");
    }, params.timeoutMs);

    const cleanup = () => {
      if (settled) {
        return;
      }
      settled = true;
      clearTimeout(timeout);
      params.peerConnection.removeEventListener?.("icegatheringstatechange", handleChange);
    };

    const handleChange = () => {
      if (params.peerConnection.iceGatheringState !== "complete") {
        return;
      }
      cleanup();
      resolve(params.peerConnection.localDescription?.sdp ?? params.fallbackDescription.sdp ?? "");
    };

    params.peerConnection.addEventListener?.("icegatheringstatechange", handleChange);
  });
}

function parseDirectChannelData(data: unknown) {
  if (typeof data === "string") {
    return data;
  }
  if (data instanceof ArrayBuffer) {
    return new TextDecoder().decode(new Uint8Array(data));
  }
  if (ArrayBuffer.isView(data)) {
    return new TextDecoder().decode(new Uint8Array(data.buffer, data.byteOffset, data.byteLength));
  }
  return String(data ?? "");
}

function isAndroidDirectResponseFrame(value: unknown): value is AndroidDirectResponseFrame {
  if (value == null || typeof value !== "object") {
    return false;
  }
  const record = value as { body?: unknown; id?: unknown; status?: unknown };
  return typeof record.id === "string" && typeof record.status === "number" && "body" in record;
}

function waitForDirectResponseFrame(params: {
  channel: DirectRequestDataChannelLike;
  requestId: string;
  timeoutMs: number;
}) {
  return new Promise<AndroidDirectResponseFrame>((resolve, reject) => {
    let settled = false;
    const timeout = setTimeout(() => {
      cleanup();
      reject(new Error(`direct request ${params.requestId} timed out`));
    }, params.timeoutMs);

    const cleanup = () => {
      if (settled) {
        return;
      }
      settled = true;
      clearTimeout(timeout);
      params.channel.removeEventListener?.("message", handleMessage);
      params.channel.removeEventListener?.("close", handleClose);
      params.channel.removeEventListener?.("error", handleError);
    };

    const handleClose = () => {
      cleanup();
      reject(new Error("direct data channel closed before response"));
    };
    const handleError = () => {
      cleanup();
      reject(new Error("direct data channel errored before response"));
    };
    const handleMessage = (event?: DirectRequestMessageEvent) => {
      const text = parseDirectChannelData(event?.data).trim();
      if (text === "") {
        return;
      }
      const firstLine = text.split(/\r?\n/, 1)[0]?.trim() ?? "";
      if (firstLine === "") {
        return;
      }
      const payload = JSON.parse(firstLine) as unknown;
      if (!isAndroidDirectResponseFrame(payload) || payload.id !== params.requestId) {
        return;
      }
      cleanup();
      resolve(payload);
    };

    params.channel.addEventListener?.("message", handleMessage);
    params.channel.addEventListener?.("close", handleClose);
    params.channel.addEventListener?.("error", handleError);
  });
}

function isDirectSignalAnswerFrame(value: unknown): value is DirectSignalAnswerFrame {
  if (value == null || typeof value !== "object") {
    return false;
  }

  const record = value as { sdp?: unknown; type?: unknown };
  return record.type === "answer" && typeof record.sdp === "string";
}

export function createAndroidDirectRequestClient(deps: Partial<DirectRequestClientDeps> = {}) {
  const resolvedDeps = { ...getDefaultDeps(), ...deps } satisfies DirectRequestClientDeps;

  return {
    async connect(input: AndroidDirectConnectInput): Promise<AndroidDirectReadyChannelSession> {
      const abortSignal = input.signal;
      throwIfAborted(abortSignal);
      const signal = await openSignalStreamAbortable({
        operation: resolvedDeps.openStreamForAddress({
          address: input.address,
          node: input.node,
          protocol: DIRECT_WEBRTC_SIGNAL_PROTOCOL,
        }),
        signal: abortSignal,
      });

      const peerConnection = resolvedDeps.peerConnectionFactory();
      let channel: DirectRequestDataChannelLike | null = null;
      let session: AndroidDirectReadyChannelSession | null = null;
      try {
        channel = peerConnection.createDataChannel(DIRECT_REQUEST_DATA_CHANNEL_LABEL);
        session = createDirectReadyChannelSession({
          channel,
          peerConnection,
          requestTimeoutMs: resolvedDeps.requestTimeoutMs,
          signal,
        });
        const readySession = session;
        const offer = await peerConnection.createOffer();
        await peerConnection.setLocalDescription(offer);
        const offerSDP = await waitForLocalDescriptionSdp({
          fallbackDescription: offer,
          peerConnection,
          timeoutMs: resolvedDeps.channelReadyTimeoutMs,
        });
        await runAbortable({
          onAbort: () => readySession.close(),
          operation: resolvedDeps.writeJsonRequest(signal, {
            peer_id: input.peerId,
            sdp: offerSDP,
            type: "offer",
          }),
          signal: abortSignal,
        });

        const frame = await runAbortable({
          onAbort: () => readySession.close(),
          operation: resolvedDeps.readJsonFrame(signal),
          signal: abortSignal,
        });
        if (!isDirectSignalAnswerFrame(frame.payload)) {
          throw new Error("expected answer frame");
        }

        await peerConnection.setRemoteDescription({
          sdp: frame.payload.sdp,
          type: "answer",
        });

        await runAbortable({
          onAbort: () => readySession.close(),
          operation: waitForDataChannelOpen(channel, resolvedDeps.channelReadyTimeoutMs),
          signal: abortSignal,
        });

        return readySession;
      } catch (error) {
        if (session != null) {
          await session.close().catch(() => undefined);
        } else {
          channel?.close?.();
          await signal.close().catch(() => undefined);
          peerConnection.close();
        }
        throw error;
      }
    },
  };
}
