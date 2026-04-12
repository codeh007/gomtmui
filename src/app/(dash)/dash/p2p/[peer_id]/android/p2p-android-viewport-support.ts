import {
  type AndroidKeyCode,
  type AndroidKeyEventAction,
  type AndroidKeyEventMeta,
  type AndroidMotionEventButton,
  h264ParseConfiguration,
  type ScrcpyMediaStreamPacket,
  ScrcpyVideoCodecId,
} from "@yume-chan/scrcpy";
import type {
  AndroidDeviceOpName,
  AndroidDeviceOpState,
  AndroidScrcpyPerformanceProfile,
  AndroidScrcpySessionSnapshot,
} from "@/lib/p2p/android-scrcpy-session";
import type { ScrcpyTouchPayload } from "./p2p-android-viewport-gesture";

export type ViewportSize = {
  height: number;
  width: number;
};

export type AndroidRemoteStatusLabel = "Busy" | "Connected" | "Connecting" | "Error" | "Reconnecting" | "Unsupported";

export type AndroidRemoteStatusView = {
  detail: string;
  label: AndroidRemoteStatusLabel;
  showBusyIndicator: boolean;
};

export type AndroidDeviceOpNotice = {
  detail: string;
  tone: "danger" | "muted" | "success" | "warning";
  title: string;
};

export type AndroidDeviceOpHint = AndroidDeviceOpNotice & {
  op: AndroidDeviceOpName;
};

export type AndroidSessionInfoItem = {
  label: string;
  value: string;
};

export type AndroidKeyCodeValue = AndroidKeyCode;

export type AndroidScrcpyVideoStreamLike = {
  height: number;
  metadata: {
    codec?: number;
    height?: number;
    width?: number;
  };
  sizeChanged: (listener: (event: { height: number; width: number }) => void) => { dispose: () => void } | (() => void);
  stream: ReadableStream<ScrcpyMediaStreamPacket>;
  width: number;
};

export type AndroidScrcpyControllerLike = {
  injectKeyCode: (message: {
    action: AndroidKeyEventAction;
    keyCode: AndroidKeyCodeValue;
    metaState: AndroidKeyEventMeta;
    repeat: number;
  }) => Promise<void>;
  injectScroll: (message: {
    buttons: AndroidMotionEventButton;
    pointerX: number;
    pointerY: number;
    scrollX: number;
    scrollY: number;
    videoHeight: number;
    videoWidth: number;
  }) => Promise<void>;
  injectText: (text: string) => Promise<void>;
  injectTouch: (message: ScrcpyTouchPayload) => Promise<void>;
  setClipboard?: (message: { content: string; paste: boolean; sequence: bigint }) => Promise<void>;
};

export type ScrcpyCanvasRenderer = {
  close: () => Promise<void>;
  renderPacket: (packet: ScrcpyMediaStreamPacket) => Promise<void>;
};

export const DEFAULT_VIEWPORT_SIZE: ViewportSize = {
  height: 720,
  width: 360,
};

export const UNSUPPORTED_BROWSER_MESSAGE = "当前浏览器不支持 Android scrcpy 远控。请改用 Chromium 桌面浏览器。";
export const CONNECTING_MESSAGE = "正在通过 ADB 隧道附着 Android scrcpy 会话。";
export const CONNECTED_MESSAGE = "scrcpy 会话已连接，Back / Home / 文本输入会直接通过浏览器侧会话发送。";
export const RECONNECTING_MESSAGE = "正在重新建立 Android scrcpy 会话。";
export const STREAM_ENDED_MESSAGE = "Android scrcpy 视频流已结束，请重新连接。";
export const BUSY_MESSAGE = "当前控制会话已被占用";
export const ERROR_MESSAGE = "当前无法建立 Android scrcpy 会话。";
export const MISSING_CONTROL_MESSAGE = "scrcpy 控制通道尚未就绪，请重新连接。";
export const MISSING_DEVICE_OPS_MESSAGE = "高级设备动作尚未就绪，请重新连接。";

export const ANDROID_KEY_ACTION_DOWN = 0 as AndroidKeyEventAction;
export const ANDROID_KEY_ACTION_UP = 1 as AndroidKeyEventAction;
export const ANDROID_KEY_CODE_HOME = 3 as AndroidKeyCodeValue;
export const ANDROID_KEY_CODE_BACK = 4 as AndroidKeyCodeValue;
export const ANDROID_KEY_CODE_DPAD_UP = 19 as AndroidKeyCodeValue;
export const ANDROID_KEY_CODE_DPAD_DOWN = 20 as AndroidKeyCodeValue;
export const ANDROID_KEY_CODE_DPAD_LEFT = 21 as AndroidKeyCodeValue;
export const ANDROID_KEY_CODE_DPAD_RIGHT = 22 as AndroidKeyCodeValue;
export const ANDROID_KEY_CODE_TAB = 61 as AndroidKeyCodeValue;
export const ANDROID_KEY_CODE_ENTER = 66 as AndroidKeyCodeValue;
export const ANDROID_KEY_CODE_DEL = 67 as AndroidKeyCodeValue;
export const ANDROID_KEY_CODE_PAGE_UP = 92 as AndroidKeyCodeValue;
export const ANDROID_KEY_CODE_PAGE_DOWN = 93 as AndroidKeyCodeValue;
export const ANDROID_KEY_CODE_ESCAPE = 111 as AndroidKeyCodeValue;
export const ANDROID_KEY_CODE_FORWARD_DEL = 112 as AndroidKeyCodeValue;
export const ANDROID_KEY_CODE_MOVE_HOME = 122 as AndroidKeyCodeValue;
export const ANDROID_KEY_CODE_MOVE_END = 123 as AndroidKeyCodeValue;
export const ANDROID_KEY_CODE_APP_SWITCH = 187 as AndroidKeyCodeValue;
export const ANDROID_KEY_META_NONE = 0 as AndroidKeyEventMeta;

const DESKTOP_POPOVER_BREAKPOINT = 1024;
const H264_FALLBACK_CODEC = "avc1.42001E";
const H265_CODEC_CANDIDATES = ["hev1.1.6.L93.B0", "hvc1.1.6.L93.B0"];
const AV1_CODEC_CANDIDATES = ["av01.0.08M.08"];

export const ANDROID_PERFORMANCE_PROFILES = [
  "low",
  "medium",
  "high",
] as const satisfies readonly AndroidScrcpyPerformanceProfile[];

export const DIRECT_ANDROID_KEY_MAP: Record<string, AndroidKeyCodeValue> = {
  ArrowDown: ANDROID_KEY_CODE_DPAD_DOWN,
  ArrowLeft: ANDROID_KEY_CODE_DPAD_LEFT,
  ArrowRight: ANDROID_KEY_CODE_DPAD_RIGHT,
  ArrowUp: ANDROID_KEY_CODE_DPAD_UP,
  Backspace: ANDROID_KEY_CODE_DEL,
  Delete: ANDROID_KEY_CODE_FORWARD_DEL,
  End: ANDROID_KEY_CODE_MOVE_END,
  Enter: ANDROID_KEY_CODE_ENTER,
  Escape: ANDROID_KEY_CODE_ESCAPE,
  Home: ANDROID_KEY_CODE_MOVE_HOME,
  PageDown: ANDROID_KEY_CODE_PAGE_DOWN,
  PageUp: ANDROID_KEY_CODE_PAGE_UP,
  Tab: ANDROID_KEY_CODE_TAB,
};

export function isTransientAndroidControlStreamClosingError(error: unknown) {
  const message = error instanceof Error ? error.message.trim().toLowerCase() : String(error).trim().toLowerCase();
  return (
    message.includes("stream is closing") ||
    message.includes("cannot write to a stream that is closing") ||
    message.includes("stream is closed") ||
    message.includes("cannot write to a stream that is closed")
  );
}

export function toRemoteStatus(
  snapshot: AndroidScrcpySessionSnapshot,
  targetSessionError: string | null,
): AndroidRemoteStatusView {
  const message = snapshot.message?.trim() || targetSessionError?.trim() || undefined;

  switch (snapshot.status) {
    case "connected":
      return {
        detail: message ?? CONNECTED_MESSAGE,
        label: "Connected",
        showBusyIndicator: false,
      };
    case "reconnecting":
      return {
        detail: message ?? RECONNECTING_MESSAGE,
        label: "Reconnecting",
        showBusyIndicator: false,
      };
    case "busy":
      return {
        detail: message ?? BUSY_MESSAGE,
        label: "Busy",
        showBusyIndicator: true,
      };
    case "unsupported":
      return {
        detail: message ?? UNSUPPORTED_BROWSER_MESSAGE,
        label: "Unsupported",
        showBusyIndicator: false,
      };
    case "error":
      return {
        detail: message ?? ERROR_MESSAGE,
        label: "Error",
        showBusyIndicator: false,
      };
    case "closed":
    case "idle":
    case "connecting":
    default:
      return {
        detail: message ?? CONNECTING_MESSAGE,
        label: "Connecting",
        showBusyIndicator: false,
      };
  }
}

export function createSnapshot(
  status: AndroidScrcpySessionSnapshot["status"],
  message?: string,
): AndroidScrcpySessionSnapshot {
  return {
    status,
    message,
  };
}

export function formatConnectElapsed(connectElapsedMs: number | undefined) {
  if (connectElapsedMs == null || !Number.isFinite(connectElapsedMs) || connectElapsedMs < 0) {
    return "未记录";
  }

  return `${Math.round(connectElapsedMs)} ms`;
}

export function isAvailableDeviceOpState(state: AndroidDeviceOpState | undefined) {
  return state?.code === "available";
}

function formatDeviceOpFailureDetail(prefix: string, message: string | undefined) {
  const normalizedMessage = message?.trim();
  if (normalizedMessage == null || normalizedMessage === "") {
    return prefix;
  }
  return `${prefix} 原因：${normalizedMessage}`;
}

export function describeDeviceOpState(
  op: AndroidDeviceOpName,
  state: AndroidDeviceOpState,
  options: { controlsEnabled: boolean },
): AndroidDeviceOpHint {
  switch (op) {
    case "rotate":
      switch (state.code) {
        case "unsupported":
          return {
            detail: "当前 scrcpy 会话明确不支持旋转设备。",
            op,
            title: "旋转不受支持",
            tone: "warning",
          };
        case "unavailable":
          return {
            detail: "当前控制通道尚未就绪，请重新连接后再试。",
            op,
            title: "旋转暂不可用",
            tone: "muted",
          };
        case "failed":
          return {
            detail: formatDeviceOpFailureDetail("这次旋转没有成功，可稍后重试。", state.message),
            op,
            title: "旋转失败",
            tone: "danger",
          };
        default:
          return {
            detail: "当前可直接发送旋转命令。",
            op,
            title: "旋转可用",
            tone: "success",
          };
      }
    case "captureScreenshot":
      switch (state.code) {
        case "unsupported":
          return {
            detail: "当前环境或目标设备不支持导出 PNG 截图。",
            op,
            title: "截图不受支持",
            tone: "warning",
          };
        case "unavailable":
          return {
            detail: "截图能力尚未就绪，请重新连接后再试。",
            op,
            title: "截图暂不可用",
            tone: "muted",
          };
        case "failed":
          return {
            detail: formatDeviceOpFailureDetail("截图导出失败，可再次尝试。", state.message),
            op,
            title: "截图失败",
            tone: "danger",
          };
        default:
          return {
            detail: "当前可导出 PNG 截图。",
            op,
            title: "截图可用",
            tone: "success",
          };
      }
    case "writeClipboard":
      switch (state.code) {
        case "unsupported":
          return {
            detail: options.controlsEnabled
              ? "当前仅支持英文、数字和常见导航键直输；中文与 Emoji 的剪贴板 fallback 不可用。"
              : "当前既没有可用控制通道，也不支持剪贴板文本发送。",
            op,
            title: options.controlsEnabled ? "剪贴板 fallback 不受支持" : "文本发送不受支持",
            tone: "warning",
          };
        case "unavailable":
          return {
            detail: options.controlsEnabled
              ? "当前控制通道可直接发送英文、数字和常见导航键；剪贴板 fallback 暂未就绪。"
              : "当前控制通道尚未就绪，文本发送暂时不可用，请尝试重新连接。",
            op,
            title: options.controlsEnabled ? "剪贴板 fallback 暂不可用" : "文本发送暂不可用",
            tone: "muted",
          };
        case "failed":
          return {
            detail: formatDeviceOpFailureDetail("这次文本发送没有成功，可再次尝试。", state.message),
            op,
            title: "文本发送失败",
            tone: "danger",
          };
        default:
          return {
            detail: options.controlsEnabled
              ? "点击画面后可直接键入英文、数字和常见导航键；中文或 Emoji 会走剪贴板 fallback。"
              : "当前会优先通过设备剪贴板发送文本。",
            op,
            title: options.controlsEnabled ? "文本输入可用" : "剪贴板发送可用",
            tone: "success",
          };
      }
  }
}

export function getViewportSize(videoStream: AndroidScrcpyVideoStreamLike | undefined): ViewportSize {
  const width = videoStream?.width || videoStream?.metadata.width || DEFAULT_VIEWPORT_SIZE.width;
  const height = videoStream?.height || videoStream?.metadata.height || DEFAULT_VIEWPORT_SIZE.height;

  return {
    height: height > 0 ? height : DEFAULT_VIEWPORT_SIZE.height,
    width: width > 0 ? width : DEFAULT_VIEWPORT_SIZE.width,
  };
}

export function isDesktopViewport() {
  if (typeof window === "undefined") {
    return false;
  }

  return window.innerWidth >= DESKTOP_POPOVER_BREAKPOINT;
}

export function subscribeDesktopViewport(callback: () => void) {
  if (typeof window === "undefined") {
    return () => undefined;
  }

  window.addEventListener("resize", callback);
  return () => {
    window.removeEventListener("resize", callback);
  };
}

export function syncCanvasSize(canvas: HTMLCanvasElement | null, viewportSize: ViewportSize) {
  if (canvas == null) {
    return;
  }

  if (canvas.width !== viewportSize.width) {
    canvas.width = viewportSize.width;
  }

  if (canvas.height !== viewportSize.height) {
    canvas.height = viewportSize.height;
  }
}

export function paintCanvasBlack(canvas: HTMLCanvasElement | null, viewportSize: ViewportSize) {
  if (canvas == null) {
    return;
  }

  syncCanvasSize(canvas, viewportSize);

  const context = canvas.getContext("2d");
  if (context == null) {
    return;
  }

  context.save();
  context.fillStyle = "#0a0a0a";
  context.fillRect(0, 0, canvas.width, canvas.height);
  context.restore();
}

function toHexByte(value: number) {
  return value.toString(16).padStart(2, "0").toUpperCase();
}

function getH264DecoderCodecCandidates(configurationData: Uint8Array | null) {
  if (configurationData == null) {
    return {
      codecs: [H264_FALLBACK_CODEC],
      description: undefined,
    };
  }

  try {
    const configuration = h264ParseConfiguration(configurationData);
    return {
      codecs: [
        `avc1.${toHexByte(configuration.profileIndex)}${toHexByte(configuration.constraintSet)}${toHexByte(configuration.levelIndex)}`,
        H264_FALLBACK_CODEC,
      ],
      description: configurationData,
    };
  } catch {
    return {
      codecs: [H264_FALLBACK_CODEC],
      description: undefined,
    };
  }
}

function getDecoderConfigCandidates(videoStream: AndroidScrcpyVideoStreamLike, configurationData: Uint8Array | null) {
  const baseConfig = {
    optimizeForLatency: true,
  } satisfies Partial<VideoDecoderConfig>;

  switch (videoStream.metadata.codec) {
    case ScrcpyVideoCodecId.H265:
      return H265_CODEC_CANDIDATES.map(
        (codec) =>
          ({
            ...baseConfig,
            codec,
            description: configurationData ?? undefined,
          }) satisfies VideoDecoderConfig,
      );
    case ScrcpyVideoCodecId.AV1:
      return AV1_CODEC_CANDIDATES.map(
        (codec) =>
          ({
            ...baseConfig,
            codec,
          }) satisfies VideoDecoderConfig,
      );
    case ScrcpyVideoCodecId.H264:
    default: {
      const h264Candidates = getH264DecoderCodecCandidates(configurationData);
      const candidates: VideoDecoderConfig[] = h264Candidates.codecs.map(
        (codec) =>
          ({
            ...baseConfig,
            codec,
            description: h264Candidates.description,
          }) satisfies VideoDecoderConfig,
      );
      if (h264Candidates.description != null) {
        candidates.push({
          ...baseConfig,
          codec: H264_FALLBACK_CODEC,
        } satisfies VideoDecoderConfig);
      }
      return candidates;
    }
  }
}

async function resolveDecoderConfig(videoStream: AndroidScrcpyVideoStreamLike, configurationData: Uint8Array | null) {
  if (typeof VideoDecoder === "undefined") {
    throw new Error("当前浏览器不支持 VideoDecoder。");
  }

  const candidates = getDecoderConfigCandidates(videoStream, configurationData);
  for (const candidate of candidates) {
    const support = await VideoDecoder.isConfigSupported(candidate).catch(() => null);
    if (support?.supported) {
      return support.config ?? candidate;
    }
  }

  if (videoStream.metadata.codec === ScrcpyVideoCodecId.H264) {
    return {
      ...candidates[candidates.length - 1],
      codec: H264_FALLBACK_CODEC,
    } satisfies VideoDecoderConfig;
  }

  throw new Error("当前浏览器不支持该 Android 视频编码流。请确认目标设备使用 Chromium 可解码的视频编码。");
}

function toChunkTimestamp(packet: Extract<ScrcpyMediaStreamPacket, { type: "data" }>, packetIndex: number) {
  if (typeof packet.pts === "bigint") {
    const numericPts = Number(packet.pts);
    if (Number.isFinite(numericPts)) {
      return numericPts;
    }
  }

  return packetIndex * 1_000;
}

export function createScrcpyCanvasRenderer(params: {
  canvas: HTMLCanvasElement;
  onError: (error: unknown) => void;
  videoStream: AndroidScrcpyVideoStreamLike;
}): ScrcpyCanvasRenderer {
  const MAX_DECODER_RECOVERY_ATTEMPTS = 3;
  if (typeof VideoDecoder === "undefined" || typeof EncodedVideoChunk === "undefined") {
    throw new Error("当前浏览器不支持 WebCodecs 视频解码。");
  }

  const context = params.canvas.getContext("2d");
  if (context == null) {
    throw new Error("当前浏览器无法初始化 Android 视频画布。");
  }

  let closed = false;
  let packetIndex = 0;
  let configurationData: Uint8Array | null = null;
  let decoder: VideoDecoder | null = null;
  let decoderRecoveryAttempts = 0;

  const closeDecoderSafely = () => {
    try {
      decoder?.close();
    } catch {
      // 浏览器刷新或 HMR teardown 时，codec 可能已经被底层实现提前关闭。
    }
  };

  const recoverDecoder = (error: unknown) => {
    if (closed) {
      return false;
    }
    decoderRecoveryAttempts += 1;
    closeDecoderSafely();
    decoder = null;
    if (decoderRecoveryAttempts > MAX_DECODER_RECOVERY_ATTEMPTS) {
      closed = true;
      params.onError(error);
      return false;
    }
    return true;
  };

  const createDecoder = () =>
    new VideoDecoder({
      error: (error) => {
        if (closed) {
          return;
        }
        recoverDecoder(error);
      },
      output: (frame) => {
        try {
          if (closed) {
            return;
          }

          decoderRecoveryAttempts = 0;

          context.drawImage(frame, 0, 0, params.canvas.width, params.canvas.height);
        } finally {
          frame.close();
        }
      },
    });

  const reconfigureDecoder = async (nextConfigurationData: Uint8Array | null) => {
    const config = await resolveDecoderConfig(params.videoStream, nextConfigurationData);
    if (closed) {
      return;
    }

    if (decoder == null) {
      decoder = createDecoder();
    } else {
      try {
        decoder.reset();
      } catch {
        closeDecoderSafely();
        decoder = createDecoder();
      }
    }

    decoder.configure(config);
  };

  const ensureDecoderConfigured = async (packet: ScrcpyMediaStreamPacket) => {
    if (packet.type === "configuration") {
      configurationData = packet.data;
    }

    if (decoder != null) {
      return;
    }

    const nextConfigurationData = configurationData ?? (packet.type === "data" ? packet.data : null);
    await reconfigureDecoder(nextConfigurationData);
  };

  const shouldReconfigureDecoder = (nextConfiguration: Uint8Array) => {
    if (configurationData == null || configurationData.byteLength !== nextConfiguration.byteLength) {
      return true;
    }

    for (let index = 0; index < nextConfiguration.byteLength; index += 1) {
      if (configurationData[index] !== nextConfiguration[index]) {
        return true;
      }
    }

    return false;
  };

  return {
    async close() {
      closed = true;
      closeDecoderSafely();
      decoder = null;
    },
    async renderPacket(packet) {
      if (closed) {
        return;
      }

      if (packet.type === "configuration") {
        const needsReconfigure = shouldReconfigureDecoder(packet.data);
        configurationData = packet.data;
        if (needsReconfigure) {
          await reconfigureDecoder(configurationData);
        } else {
          await ensureDecoderConfigured(packet);
        }
        return;
      }

      await ensureDecoderConfigured(packet);
      if (closed || decoder == null) {
        return;
      }

      try {
        decoder.decode(
          new EncodedVideoChunk({
            data: packet.data,
            timestamp: toChunkTimestamp(packet, packetIndex),
            type: packet.keyframe === true ? "key" : "delta",
          }),
        );
      } catch (error) {
        if (!recoverDecoder(error)) {
          return;
        }
        return;
      }
      packetIndex += 1;
    },
  };
}
