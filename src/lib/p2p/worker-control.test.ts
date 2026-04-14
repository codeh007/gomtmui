import { beforeEach, describe, expect, it, vi } from "vitest";

const libp2pStreamMocks = vi.hoisted(() => {
  const close = vi.fn(async () => undefined);
  const onDrain = vi.fn(async () => undefined);
  const send = vi.fn(() => true);
  return {
    close,
    onDrain,
    openStreamForAddress: vi.fn(async () => ({ close, onDrain, send })),
    readJsonFrame: vi.fn(),
    send,
    writeJsonRequest: vi.fn(async () => undefined),
  };
});

vi.mock("./libp2p-stream", () => ({
  openStreamForAddress: libp2pStreamMocks.openStreamForAddress,
  readJsonFrame: libp2pStreamMocks.readJsonFrame,
  writeJsonRequest: libp2pStreamMocks.writeJsonRequest,
}));

import {
  ensureNativeRemoteV2Stream,
  openNativeRemoteV2VideoStream,
} from "./worker-control";

describe("ensureNativeRemoteV2Stream", () => {
  beforeEach(() => {
    libp2pStreamMocks.close.mockClear();
    libp2pStreamMocks.onDrain.mockClear();
    libp2pStreamMocks.send.mockClear();
    libp2pStreamMocks.openStreamForAddress.mockClear();
    libp2pStreamMocks.readJsonFrame.mockReset();
    libp2pStreamMocks.writeJsonRequest.mockClear();
  });

  it("rejects empty remote_control_payload descriptor", async () => {
    libp2pStreamMocks.readJsonFrame.mockResolvedValue({
      payload: {
        payload: {
          ok: true,
          result: {
            remote_control_payload: {},
          },
        },
      },
    });

    await expect(
      ensureNativeRemoteV2Stream({
        address: "/ip4/127.0.0.1/tcp/4101/p2p/12D3KooWAndroid",
        node: {} as never,
        peerId: "12D3KooWAndroid",
      }),
    ).rejects.toMatchObject({
      code: "SB_BAD_FRAME",
      message: "screen.stream.ensure returned no usable remote_control_payload",
    });
  });
});

describe("openNativeRemoteV2VideoStream", () => {
  beforeEach(() => {
    libp2pStreamMocks.close.mockClear();
    libp2pStreamMocks.onDrain.mockClear();
    libp2pStreamMocks.send.mockClear();
    libp2pStreamMocks.openStreamForAddress.mockClear();
    libp2pStreamMocks.readJsonFrame.mockReset();
    libp2pStreamMocks.writeJsonRequest.mockClear();
  });

  it("opens a loopback tcp worker stream for native remote v2 video", async () => {
    async function* createRemainingSource() {
      yield new Uint8Array([0, 0, 0, 0]);
    }

    libp2pStreamMocks.readJsonFrame.mockResolvedValue({
      payload: {
        payload: {
          channel: {
            codec: "avc1.64001f",
            framing: "length_prefixed_access_units",
            height: 1920,
            kind: "video_h264_annexb",
            keyframe_required_on_start: true,
            rotation: 0,
            width: 1080,
          },
          ok: true,
        },
      },
      remainingSource: createRemainingSource(),
    });

    const result = await openNativeRemoteV2VideoStream({
      address: "/ip4/127.0.0.1/tcp/4101/p2p/12D3KooWAndroid",
      descriptor: {
        channel: {
          codec: "avc1.64001f",
          framing: "length_prefixed_access_units",
          height: 1920,
          kind: "video_h264_annexb",
          keyframeRequiredOnStart: true,
          rotation: 0,
          width: 1080,
        },
        resolved: {
          host: "127.0.0.1",
          kind: "loopback_tcp",
          port: 9200,
          protocolHint: "tcp",
          serviceHint: "android_media_projection_h264",
        },
        status: "streaming",
      },
      node: {} as never,
      peerId: "12D3KooWAndroid",
    });

    expect(libp2pStreamMocks.writeJsonRequest).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        payload: {
          target: {
            host: "127.0.0.1",
            kind: "loopback_tcp",
            port: 9200,
            protocol_hint: "tcp",
            service_hint: "android_media_projection_h264",
          },
        },
      }),
    );
    expect(result.metadata).toMatchObject({
      codec: "avc1.64001f",
      height: 1920,
      width: 1080,
    });
  });
});
