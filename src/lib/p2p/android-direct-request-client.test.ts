import { afterEach, describe, expect, it, vi } from "vitest";
import { createAndroidDirectRequestClient, DIRECT_WEBRTC_SIGNAL_PROTOCOL } from "./android-direct-request-client";

type ReadJsonFrameResult = {
  payload: unknown;
  remainingSource: AsyncGenerator<Uint8Array, void, unknown>;
};

function createDeferred<T>() {
  let resolveRef: ((value: T | PromiseLike<T>) => void) | null = null;
  let rejectRef: ((reason?: unknown) => void) | null = null;
  const promise = new Promise<T>((resolve, reject) => {
    resolveRef = resolve;
    rejectRef = reject;
  });

  return {
    promise,
    reject(reason?: unknown) {
      rejectRef?.(reason);
    },
    resolve(value: T) {
      resolveRef?.(value);
    },
  };
}

function createSignalStream(answerPayload: { sdp?: string; type: string } = { type: "answer", sdp: "answer-sdp" }) {
  return {
    close: vi.fn(async () => undefined),
    onDrain: vi.fn(async () => undefined),
    send: vi.fn(() => true),
    [Symbol.asyncIterator]: async function* () {
      yield new TextEncoder().encode(`${JSON.stringify(answerPayload)}\n`);
    },
  };
}

function createMockDataChannel(initialState: "connecting" | "open" = "connecting") {
  const listeners = {
    close: new Set<() => void>(),
    error: new Set<() => void>(),
    message: new Set<(event: { data: unknown }) => void>(),
    open: new Set<() => void>(),
  };

  return {
    addEventListener(
      type: "close" | "error" | "message" | "open",
      listener: ((event?: { data: unknown }) => void) | (() => void),
    ) {
      listeners[type].add(listener as never);
    },
    close: vi.fn(function (this: { emit: (type: "close" | "error" | "open") => void; readyState: string }) {
      this.readyState = "closed";
      this.emit("close");
    }),
    emit(type: "close" | "error" | "open") {
      if (type === "open") {
        this.readyState = "open";
      }
      for (const listener of listeners[type]) {
        listener();
      }
    },
    emitMessage(data: unknown) {
      for (const listener of listeners.message) {
        listener({ data });
      }
    },
    readyState: initialState,
    removeEventListener(
      type: "close" | "error" | "message" | "open",
      listener: ((event?: { data: unknown }) => void) | (() => void),
    ) {
      listeners[type].delete(listener as never);
    },
    send: vi.fn(),
  };
}

function createPeerConnection(
  channel: ReturnType<typeof createMockDataChannel>,
  setRemoteDescription = vi.fn(async () => undefined),
) {
  return {
    close: vi.fn(),
    createDataChannel: vi.fn(() => channel),
    createOffer: vi.fn(async () => ({ sdp: "offer-sdp", type: "offer" as const })),
    setLocalDescription: vi.fn(async () => undefined),
    setRemoteDescription,
  };
}

afterEach(() => {
  vi.useRealTimers();
});

describe("createAndroidDirectRequestClient", () => {
  it("waits for the data channel to open before returning a ready session", async () => {
    const setRemoteDescription = vi.fn(async () => undefined);
    const channel = createMockDataChannel();
    const signal = createSignalStream();

    const client = createAndroidDirectRequestClient({
      openStreamForAddress: vi.fn(async () => signal),
      peerConnectionFactory: vi.fn(() => createPeerConnection(channel, setRemoteDescription)),
    });

    let settled = false;
    const sessionPromise = client
      .connect({
        address: "/ip4/127.0.0.1/udp/4101/quic-v1/webtransport/p2p/12D3KooWPeerAndroid",
        node: {} as never,
        peerId: "12D3KooWPeerAndroid",
      })
      .then((session) => {
        settled = true;
        return session;
      });

    await vi.waitFor(() => {
      expect(setRemoteDescription).toHaveBeenCalledWith({
        sdp: "answer-sdp",
        type: "answer",
      });
    });

    expect(settled).toBe(false);
    channel.emit("open");

    const session = await sessionPromise;

    expect(session.channel).toBe(channel);
    expect(setRemoteDescription).toHaveBeenCalledTimes(1);
    expect(signal.close).not.toHaveBeenCalled();
    expect(channel.close).not.toHaveBeenCalled();
  });

  it("opens the signaling stream against the current peer address", async () => {
    const signal = createSignalStream();
    const openStreamForAddress = vi.fn(async () => signal);
    const channel = createMockDataChannel("open");

    const client = createAndroidDirectRequestClient({
      openStreamForAddress,
      peerConnectionFactory: vi.fn(() => createPeerConnection(channel)),
    });

    const session = await client.connect({
      address: "/ip4/127.0.0.1/udp/4101/quic-v1/webtransport/p2p/12D3KooWPeerAndroid",
      node: {} as never,
      peerId: "12D3KooWPeerAndroid",
    });

    expect(openStreamForAddress).toHaveBeenCalledWith(
      expect.objectContaining({
        address: "/ip4/127.0.0.1/udp/4101/quic-v1/webtransport/p2p/12D3KooWPeerAndroid",
        protocol: DIRECT_WEBRTC_SIGNAL_PROTOCOL,
      }),
    );
    expect(session.channel).toBe(channel);
    await session.close();
  });

  it("sends driver_info requests over the ready data channel and resolves JSON responses", async () => {
    const signal = createSignalStream();
    const channel = createMockDataChannel("open");
    const client = createAndroidDirectRequestClient({
      openStreamForAddress: vi.fn(async () => signal),
      peerConnectionFactory: vi.fn(() => createPeerConnection(channel)),
    });

    const session = await client.connect({
      address: "/ip4/127.0.0.1/udp/4101/quic-v1/webtransport/p2p/12D3KooWPeerAndroid",
      node: {} as never,
      peerId: "12D3KooWPeerAndroid",
    });

    const responsePromise = session.request({
      method: "GET",
      path: "/api/driver_info",
    });

    await vi.waitFor(() => {
      expect(channel.send).toHaveBeenCalledTimes(1);
    });

    const requestPayload = channel.send.mock.calls[0]?.[0];
    expect(typeof requestPayload).toBe("string");
    const requestFrame = JSON.parse(String(requestPayload).trim()) as {
      id: string;
      method: string;
      path: string;
    };
    expect(requestFrame.method).toBe("GET");
    expect(requestFrame.path).toBe("/api/driver_info");

    channel.emitMessage(`${JSON.stringify({ id: requestFrame.id, status: 200, body: { platform: "android" } })}\n`);

    await expect(responsePromise).resolves.toEqual({
      body: {
        platform: "android",
      },
      id: requestFrame.id,
      status: 200,
    });
  });

  it("rejects non-answer signaling frames", async () => {
    const channel = createMockDataChannel("open");
    const client = createAndroidDirectRequestClient({
      openStreamForAddress: vi.fn(async () => createSignalStream({ type: "ice-candidate" })),
      peerConnectionFactory: vi.fn(() => createPeerConnection(channel)),
    });

    await expect(
      client.connect({
        address: "/ip4/127.0.0.1/udp/4101/quic-v1/webtransport/p2p/12D3KooWPeerAndroid",
        node: {} as never,
        peerId: "12D3KooWPeerAndroid",
      }),
    ).rejects.toThrow("expected answer frame");
  });

  it("closes the partial connection when the data channel never becomes ready", async () => {
    vi.useFakeTimers();
    const signal = createSignalStream();
    const channel = createMockDataChannel();
    const peerConnection = createPeerConnection(channel);
    const client = createAndroidDirectRequestClient({
      channelReadyTimeoutMs: 25,
      openStreamForAddress: vi.fn(async () => signal),
      peerConnectionFactory: vi.fn(() => peerConnection),
    });

    const sessionPromise = client.connect({
      address: "/ip4/127.0.0.1/udp/4101/quic-v1/webtransport/p2p/12D3KooWPeerAndroid",
      node: {} as never,
      peerId: "12D3KooWPeerAndroid",
    });
    const rejected = expect(sessionPromise).rejects.toThrow("direct data channel did not open in time");

    await vi.advanceTimersByTimeAsync(30);

    await rejected;
    expect(signal.close).toHaveBeenCalledTimes(1);
    expect(channel.close).toHaveBeenCalledTimes(1);
    expect(peerConnection.close).toHaveBeenCalledTimes(1);
  });

  it("still rejects with AbortError when aborting while waiting for the data channel to open", async () => {
    const controller = new AbortController();
    const signal = createSignalStream();
    const channel = createMockDataChannel();
    const setRemoteDescription = vi.fn(async () => undefined);
    const peerConnection = createPeerConnection(channel, setRemoteDescription);
    const client = createAndroidDirectRequestClient({
      openStreamForAddress: vi.fn(async () => signal),
      peerConnectionFactory: vi.fn(() => peerConnection),
    });

    const sessionPromise = client.connect({
      address: "/ip4/127.0.0.1/udp/4101/quic-v1/webtransport/p2p/12D3KooWPeerAndroid",
      node: {} as never,
      peerId: "12D3KooWPeerAndroid",
      signal: controller.signal,
    });
    const aborted = expect(sessionPromise).rejects.toMatchObject({
      name: "AbortError",
    });

    await vi.waitFor(() => {
      expect(setRemoteDescription).toHaveBeenCalledTimes(1);
    });

    controller.abort();

    await aborted;
    expect(signal.close).toHaveBeenCalledTimes(1);
    expect(channel.close).toHaveBeenCalledTimes(1);
    expect(peerConnection.close).toHaveBeenCalledTimes(1);
  });

  it("aborts while waiting for the signaling answer and closes opened resources", async () => {
    const controller = new AbortController();
    const signal = createSignalStream();
    const channel = createMockDataChannel();
    const peerConnection = createPeerConnection(channel);
    const readJsonFrameMock = vi.fn(
      () =>
        new Promise<ReadJsonFrameResult>(() => {
          return undefined;
        }),
    );
    const client = createAndroidDirectRequestClient({
      openStreamForAddress: vi.fn(async () => signal),
      peerConnectionFactory: vi.fn(() => peerConnection),
      readJsonFrame: readJsonFrameMock,
    });
    const connectInput = {
      address: "/ip4/127.0.0.1/udp/4101/quic-v1/webtransport/p2p/12D3KooWPeerAndroid",
      node: {} as never,
      peerId: "12D3KooWPeerAndroid",
      signal: controller.signal,
    } as {
      address: string;
      node: never;
      peerId: string;
    };

    const sessionPromise = client.connect(connectInput);
    const aborted = expect(sessionPromise).rejects.toMatchObject({
      name: "AbortError",
    });

    await vi.waitFor(() => {
      expect(readJsonFrameMock).toHaveBeenCalledTimes(1);
    });

    controller.abort();

    await aborted;
    expect(signal.close).toHaveBeenCalledTimes(1);
    expect(peerConnection.close).toHaveBeenCalledTimes(1);
  });

  it("aborts while writeJsonRequest is still pending and closes opened resources", async () => {
    const controller = new AbortController();
    const signal = createSignalStream();
    const channel = createMockDataChannel();
    const peerConnection = createPeerConnection(channel);
    const writeJsonRequestMock = vi.fn(
      () =>
        new Promise<void>(() => {
          return undefined;
        }),
    );
    const client = createAndroidDirectRequestClient({
      openStreamForAddress: vi.fn(async () => signal),
      peerConnectionFactory: vi.fn(() => peerConnection),
      writeJsonRequest: writeJsonRequestMock,
    });

    const sessionPromise = client.connect({
      address: "/ip4/127.0.0.1/udp/4101/quic-v1/webtransport/p2p/12D3KooWPeerAndroid",
      node: {} as never,
      peerId: "12D3KooWPeerAndroid",
      signal: controller.signal,
    });
    const aborted = expect(sessionPromise).rejects.toMatchObject({
      name: "AbortError",
    });

    await vi.waitFor(() => {
      expect(writeJsonRequestMock).toHaveBeenCalledTimes(1);
    });

    controller.abort();

    await aborted;
    expect(signal.close).toHaveBeenCalledTimes(1);
    expect(channel.close).toHaveBeenCalledTimes(1);
    expect(peerConnection.close).toHaveBeenCalledTimes(1);
  });

  it("returns abort immediately while openStream is still pending and closes the late stream once it resolves", async () => {
    const controller = new AbortController();
    const lateStream = createSignalStream();
    const openStream = createDeferred<typeof lateStream>();
    const peerConnectionFactory = vi.fn(() => createPeerConnection(createMockDataChannel("open")));
    const client = createAndroidDirectRequestClient({
      openStreamForAddress: vi.fn(() => openStream.promise),
      peerConnectionFactory,
    });

    const sessionPromise = client.connect({
      address: "/ip4/127.0.0.1/udp/4101/quic-v1/webtransport/p2p/12D3KooWPeerAndroid",
      node: {} as never,
      peerId: "12D3KooWPeerAndroid",
      signal: controller.signal,
    });
    const aborted = expect(sessionPromise).rejects.toMatchObject({
      name: "AbortError",
    });

    controller.abort();

    await aborted;
    expect(peerConnectionFactory).not.toHaveBeenCalled();

    openStream.resolve(lateStream);

    await vi.waitFor(() => {
      expect(lateStream.close).toHaveBeenCalledTimes(1);
    });
  });
});
