"use client";

type NativeRemoteV2VideoPacket = {
  data: Uint8Array;
  keyframe: boolean;
  ptsUs: bigint;
  type: "data";
};

const FALLBACK_H264_CODEC = "avc1.42001E";

export type NativeAndroidVideoMetadata = {
  codec?: string;
  height?: number;
  rotation?: number;
  width?: number;
};

export type NativeAndroidCanvasRenderer = {
  close: () => Promise<void>;
  renderPacket: (packet: NativeRemoteV2VideoPacket) => Promise<void>;
};

export function createNativeAndroidCanvasRenderer(params: {
  canvas: HTMLCanvasElement;
  metadata: NativeAndroidVideoMetadata;
  onError: (error: unknown) => void;
}): NativeAndroidCanvasRenderer {
  if (typeof VideoDecoder === "undefined" || typeof EncodedVideoChunk === "undefined") {
    throw new Error("当前浏览器不支持 WebCodecs 视频解码。");
  }

  const context = params.canvas.getContext("2d");
  if (context == null) {
    throw new Error("当前浏览器无法初始化 Android 视频画布。");
  }

  let closed = false;
  let decoder: VideoDecoder | null = null;
  let hasDecodedKeyframe = false;

  const createDecoder = () =>
    new VideoDecoder({
      error: (error) => {
        if (!closed) {
          params.onError(error);
        }
      },
      output: (frame) => {
        try {
          if (closed) {
            return;
          }
          context.drawImage(frame, 0, 0, params.canvas.width, params.canvas.height);
        } finally {
          frame.close();
        }
      },
    });

  const configureDecoder = async () => {
    const candidate = {
      codec: params.metadata.codec?.trim() || FALLBACK_H264_CODEC,
      optimizeForLatency: true,
    } satisfies VideoDecoderConfig;
    const support = await VideoDecoder.isConfigSupported(candidate).catch(() => null);
    if (closed) {
      return;
    }
    decoder = createDecoder();
    decoder.configure(support?.config ?? candidate);
  };

  return {
    async close() {
      closed = true;
      try {
        decoder?.close();
      } catch {
        // no-op
      }
      decoder = null;
    },
    async renderPacket(packet) {
      if (closed) {
        return;
      }
      if (!hasDecodedKeyframe) {
        if (!packet.keyframe) {
          return;
        }
        hasDecodedKeyframe = true;
      }
      if (decoder == null) {
        await configureDecoder();
      }
      if (closed || decoder == null) {
        return;
      }
      decoder.decode(
        new EncodedVideoChunk({
          data: packet.data,
          timestamp: Number(packet.ptsUs),
          type: packet.keyframe ? "key" : "delta",
        }),
      );
    },
  };
}
