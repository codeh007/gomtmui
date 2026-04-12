import type { ScrcpyControlMessageWriter } from "@yume-chan/scrcpy";
import {
  type AdbResourceRef,
  createAdbDaemonConnection,
  type OpenAdbTransportResult,
  openAdbTransport,
} from "./adb-transport";
import type { DeviceStatus, RemoteControlState } from "./discovery-contracts";
import { type BrowserNodeLike, openStreamForAddress, readJsonFrame, writeJsonRequest } from "./libp2p-stream";
import { invokeDeviceStatus, WorkerControlRequestError } from "./worker-control";

const INVOKE_PROTOCOL = "/gomtm/worker-sb/invoke/1.0.0";
const SCRCPY_SERVER_VERSION = "3.3.3";
const SCRCPY_SERVER_PUBLIC_PATH = `/vendor/scrcpy/scrcpy-server-v${SCRCPY_SERVER_VERSION}`;
const DEFAULT_CONNECT_STEP_TIMEOUT_MS = 15000;
const CONNECT_STEP_TIMEOUT_OVERRIDES_MS: Partial<Record<string, number>> = {
  "start scrcpy session": 45000,
};
const TRANSIENT_ADB_SESSION_RETRY_DELAYS_MS = [250, 1500] as const;

export const ANDROID_SCRCPY_SESSION_MODULE_GENERATION = `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;

function logAndroidScrcpySession(message: string, details?: Record<string, unknown>) {
  if (details == null) {
    console.log(`[android-scrcpy-session] ${message}`);
    return;
  }
  console.log(`[android-scrcpy-session] ${message} ${JSON.stringify(details)}`);
}

type RecordShape = Record<string, unknown>;

export type AndroidScrcpySessionStatus =
  | "idle"
  | "connecting"
  | "connected"
  | "reconnecting"
  | "busy"
  | "unsupported"
  | "closed"
  | "error";

export type AndroidScrcpySessionSnapshot = {
  connectElapsedMs?: number;
  status: AndroidScrcpySessionStatus;
  message?: string;
  profile?: AndroidScrcpyPerformanceProfile;
  sessionId?: string;
};

export type AndroidScrcpyPerformanceProfile = "high" | "low" | "medium";

export type AndroidScrcpyPerformanceTuning = {
  label: string;
  maxFps: number;
  maxSize: number;
  videoBitRate: number;
};

export type AndroidDeviceOpCode = "failed" | "unavailable" | "unsupported";

export type AndroidDeviceOpStateCode = "available" | AndroidDeviceOpCode;

export type AndroidDeviceOpName = "captureScreenshot" | "rotate" | "writeClipboard";

export type AndroidDeviceOpState = {
  code: AndroidDeviceOpStateCode;
  message?: string;
};

export type AndroidDeviceOpStatusMap = Record<AndroidDeviceOpName, AndroidDeviceOpState>;

export type AndroidDeviceScreenshot = {
  blob: Blob;
  height: number;
  mimeType: "image/png";
  width: number;
};

export type AndroidDeviceOps = {
  status: AndroidDeviceOpStatusMap;
  captureScreenshot: () => Promise<AndroidDeviceScreenshot>;
  rotate: () => Promise<void>;
  writeClipboard: (content: string, options?: { paste?: boolean }) => Promise<void>;
};

export class AndroidDeviceOpError extends Error {
  code: AndroidDeviceOpCode;
  op: AndroidDeviceOpName;

  constructor(op: AndroidDeviceOpName, code: AndroidDeviceOpCode, message: string) {
    super(message);
    this.name = "AndroidDeviceOpError";
    this.code = code;
    this.op = op;
    Object.setPrototypeOf(this, AndroidDeviceOpError.prototype);
  }
}

export type AndroidScrcpyHandle = {
  close: () => Promise<void>;
  controller?: ScrcpyControlMessageWriter;
  videoStream?: Promise<unknown>;
};

type PrepareScrcpySessionParams = {
  adb: AdbLike;
  address: string;
  node: BrowserNodeLike;
  peerId: string;
  workerPeerId: string;
};

type StartScrcpySessionParams = PrepareScrcpySessionParams & {
  profile: AndroidScrcpyPerformanceProfile;
  scid: string;
};

export type AdbLike = {
  close: () => Promise<void>;
};

let scrcpyServerBytesPromise: Promise<Uint8Array> | null = null;
const preparedScrcpyServerCache = new Set<string>();

function getPreparedScrcpyServerCacheKey(workerPeerId: string) {
  return `${SCRCPY_SERVER_VERSION}:${workerPeerId}`;
}

function clearPreparedScrcpyServer(workerPeerId: string) {
  preparedScrcpyServerCache.delete(getPreparedScrcpyServerCacheKey(workerPeerId));
}

export type AttachedAdbHandle = {
  adb: AdbLike;
  close: () => Promise<void>;
};

export type AndroidScrcpyLiveSession = {
  sessionId: string;
  resource: AdbResourceRef;
  transport: OpenAdbTransportResult;
  adb: AttachedAdbHandle;
  deviceOps: AndroidDeviceOps;
  scrcpy: AndroidScrcpyHandle;
  stopHeartbeat?: () => void;
};

const ADB_CREDENTIAL_STORAGE_KEY = "gomtm.p2p.android.adb-credentials.v1";

export class AndroidScrcpySessionError extends Error {
  code: "busy" | "unsupported" | "error";

  constructor(message: string, code: "busy" | "unsupported" | "error" = "error") {
    super(message);
    this.name = "AndroidScrcpySessionError";
    this.code = code;
    Object.setPrototypeOf(this, AndroidScrcpySessionError.prototype);
  }
}

type AndroidScrcpySessionServiceDeps = {
  getDeviceStatus: (params: {
    address: string;
    node: BrowserNodeLike;
    peerId: string;
  }) => Promise<DeviceStatus | undefined>;
  ensureAdbSession: (params: {
    address: string;
    forceTakeover?: boolean;
    node: BrowserNodeLike;
    peerId: string;
  }) => Promise<AdbResourceRef>;
  stopAdbSession: (params: {
    address: string;
    node: BrowserNodeLike;
    peerId: string;
    resource: AdbResourceRef;
  }) => Promise<void>;
  openTransport: (params: {
    address: string;
    node: BrowserNodeLike;
    peerId: string;
    resource: AdbResourceRef;
  }) => Promise<OpenAdbTransportResult>;
  attachAdb: (params: {
    address: string;
    node: BrowserNodeLike;
    peerId: string;
    workerPeerId: string;
    resource: AdbResourceRef;
    transport: OpenAdbTransportResult;
  }) => Promise<AttachedAdbHandle>;
  prepareScrcpyServer: (params: {
    adb: AdbLike;
    address: string;
    node: BrowserNodeLike;
    peerId: string;
    workerPeerId: string;
  }) => Promise<void>;
  startScrcpySession: (params: {
    adb: AdbLike;
    address: string;
    node: BrowserNodeLike;
    peerId: string;
    profile: AndroidScrcpyPerformanceProfile;
    scid: string;
    workerPeerId: string;
  }) => Promise<AndroidScrcpyHandle>;
  createDeviceOps: (params: {
    adb: AdbLike;
    scrcpy: AndroidScrcpyHandle;
  }) => Promise<AndroidDeviceOps> | AndroidDeviceOps;
};

export type CreateAndroidScrcpySessionServiceParams = {
  address: string;
  node: BrowserNodeLike;
  peerId: string;
  profile?: AndroidScrcpyPerformanceProfile;
  workerPeerId: string;
  deps?: Partial<AndroidScrcpySessionServiceDeps>;
};

type InvokeErrorShape = {
  code: string;
  message: string;
  retryable: boolean;
};

function asRecord(value: unknown) {
  return value !== null && typeof value === "object" ? (value as RecordShape) : null;
}

function asString(value: unknown) {
  return typeof value === "string" ? value : "";
}

function asNumber(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

function createDeviceOpError(op: AndroidDeviceOpName, code: AndroidDeviceOpCode, message: string) {
  return new AndroidDeviceOpError(op, code, message);
}

function createAvailableDeviceOpState(): AndroidDeviceOpState {
  return { code: "available" };
}

export function resolveAndroidScrcpyPerformanceTuning(
  profile: AndroidScrcpyPerformanceProfile,
): AndroidScrcpyPerformanceTuning {
  switch (profile) {
    case "low":
      return {
        label: "低档",
        maxFps: 24,
        maxSize: 720,
        videoBitRate: 2_000_000,
      };
    case "high":
      return {
        label: "高档",
        maxFps: 60,
        maxSize: 1440,
        videoBitRate: 8_000_000,
      };
    case "medium":
    default:
      return {
        label: "中档",
        maxFps: 30,
        maxSize: 1080,
        videoBitRate: 4_000_000,
      };
  }
}

function createDeviceOpState(code: AndroidDeviceOpStateCode, message?: string): AndroidDeviceOpState {
  return message == null ? { code } : { code, message };
}

function getCaptureScreenshotSupportState(): AndroidDeviceOpState {
  if (typeof ImageData === "undefined") {
    return createDeviceOpState("unsupported", "当前浏览器缺少 ImageData，无法导出截图。");
  }

  if (typeof OffscreenCanvas === "undefined" && typeof document === "undefined") {
    return createDeviceOpState("unsupported", "当前运行环境无法导出 PNG 截图。");
  }

  return createAvailableDeviceOpState();
}

function readFramebufferChannel(value: number, offset: number, length: number) {
  if (!Number.isInteger(offset) || offset < 0 || !Number.isInteger(length) || length < 0) {
    throw createDeviceOpError("captureScreenshot", "unsupported", "当前 framebuffer 像素格式无效，无法导出截图。");
  }
  if (length === 0) {
    return 0;
  }
  if (length > 8) {
    throw createDeviceOpError("captureScreenshot", "unsupported", `当前 framebuffer 通道位深 ${length} 暂不支持。`);
  }

  const mask = (1 << length) - 1;
  const raw = (value >>> offset) & mask;
  return Math.round((raw / mask) * 255);
}

function decodeFramebufferToRgba(framebuffer: {
  alpha_length: number;
  alpha_offset: number;
  bpp: number;
  data: Uint8Array;
  height: number;
  width: number;
  blue_length: number;
  blue_offset: number;
  green_length: number;
  green_offset: number;
  red_length: number;
  red_offset: number;
}) {
  if (framebuffer.bpp !== 32) {
    throw createDeviceOpError(
      "captureScreenshot",
      "unsupported",
      `当前 framebuffer 位深 ${framebuffer.bpp} 暂不支持截图导出。`,
    );
  }

  const pixelCount = framebuffer.width * framebuffer.height;
  const expectedSize = pixelCount * 4;
  if (framebuffer.data.byteLength < expectedSize) {
    throw createDeviceOpError("captureScreenshot", "failed", "当前 framebuffer 数据不完整，无法导出截图。");
  }

  const rgba = new Uint8ClampedArray(expectedSize);
  const view = new DataView(framebuffer.data.buffer, framebuffer.data.byteOffset, expectedSize);

  for (let index = 0; index < pixelCount; index += 1) {
    const pixel = view.getUint32(index * 4, true);
    const outputOffset = index * 4;
    rgba[outputOffset] = readFramebufferChannel(pixel, framebuffer.red_offset, framebuffer.red_length);
    rgba[outputOffset + 1] = readFramebufferChannel(pixel, framebuffer.green_offset, framebuffer.green_length);
    rgba[outputOffset + 2] = readFramebufferChannel(pixel, framebuffer.blue_offset, framebuffer.blue_length);
    rgba[outputOffset + 3] =
      framebuffer.alpha_length > 0
        ? readFramebufferChannel(pixel, framebuffer.alpha_offset, framebuffer.alpha_length)
        : 255;
  }

  return rgba;
}

async function encodePngBlob(params: { height: number; rgba: Uint8ClampedArray; width: number }) {
  if (typeof ImageData === "undefined") {
    throw createDeviceOpError("captureScreenshot", "unsupported", "当前浏览器缺少 ImageData，无法导出截图。");
  }

  const imageData = new ImageData(Uint8ClampedArray.from(params.rgba), params.width, params.height);

  if (typeof OffscreenCanvas !== "undefined") {
    const canvas = new OffscreenCanvas(params.width, params.height);
    const context = canvas.getContext("2d");
    if (context == null) {
      throw createDeviceOpError("captureScreenshot", "unsupported", "当前浏览器无法创建截图画布。");
    }
    context.putImageData(imageData, 0, 0);
    return canvas.convertToBlob({ type: "image/png" });
  }

  if (typeof document === "undefined") {
    throw createDeviceOpError("captureScreenshot", "unsupported", "当前运行环境无法导出 PNG 截图。");
  }

  const canvas = document.createElement("canvas");
  canvas.width = params.width;
  canvas.height = params.height;
  const context = canvas.getContext("2d");
  if (context == null) {
    throw createDeviceOpError("captureScreenshot", "unsupported", "当前浏览器无法创建截图画布。");
  }
  context.putImageData(imageData, 0, 0);

  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob == null) {
        reject(createDeviceOpError("captureScreenshot", "failed", "当前浏览器未能生成 PNG 截图。"));
        return;
      }
      resolve(blob);
    }, "image/png");
  });
}

async function defaultCreateDeviceOps(params: {
  adb: AdbLike;
  scrcpy: AndroidScrcpyHandle;
}): Promise<AndroidDeviceOps> {
  const controller = params.scrcpy.controller;
  const status: AndroidDeviceOpStatusMap = {
    captureScreenshot: getCaptureScreenshotSupportState(),
    rotate:
      controller == null
        ? createDeviceOpState("unavailable", "当前 scrcpy 旋转能力尚未就绪，请重新连接。")
        : typeof controller.rotateDevice !== "function"
          ? createDeviceOpState("unsupported", "当前 scrcpy 会话不支持旋转设备。")
          : createAvailableDeviceOpState(),
    writeClipboard:
      controller == null
        ? createDeviceOpState("unavailable", "当前 scrcpy 剪贴板能力尚未就绪，请重新连接。")
        : typeof controller.setClipboard !== "function"
          ? createDeviceOpState("unsupported", "当前 scrcpy 会话不支持写入设备剪贴板。")
          : createAvailableDeviceOpState(),
  };

  return {
    status,
    writeClipboard: async (content, options) => {
      if (controller == null) {
        throw createDeviceOpError("writeClipboard", "unavailable", "当前 scrcpy 剪贴板能力尚未就绪，请重新连接。");
      }
      if (typeof controller.setClipboard !== "function") {
        throw createDeviceOpError("writeClipboard", "unsupported", "当前 scrcpy 会话不支持写入设备剪贴板。");
      }

      try {
        await controller.setClipboard({
          content,
          paste: options?.paste === true,
          sequence: 0n,
        });
      } catch (error) {
        throw createDeviceOpError(
          "writeClipboard",
          "failed",
          error instanceof Error ? error.message : "写入设备剪贴板失败。",
        );
      }
    },
    rotate: async () => {
      if (controller == null) {
        throw createDeviceOpError("rotate", "unavailable", "当前 scrcpy 旋转能力尚未就绪，请重新连接。");
      }
      if (typeof controller.rotateDevice !== "function") {
        throw createDeviceOpError("rotate", "unsupported", "当前 scrcpy 会话不支持旋转设备。");
      }

      try {
        await controller.rotateDevice();
      } catch (error) {
        throw createDeviceOpError("rotate", "failed", error instanceof Error ? error.message : "旋转设备失败。");
      }
    },
    captureScreenshot: async () => {
      try {
        const { framebuffer } = await import("@yume-chan/adb");
        const snapshot = await framebuffer(params.adb as never);
        const rgba = decodeFramebufferToRgba(snapshot);
        const blob = await encodePngBlob({
          height: snapshot.height,
          rgba,
          width: snapshot.width,
        });
        return {
          blob,
          height: snapshot.height,
          mimeType: "image/png",
          width: snapshot.width,
        } satisfies AndroidDeviceScreenshot;
      } catch (error) {
        if (error instanceof AndroidDeviceOpError) {
          throw error;
        }

        const { AdbFrameBufferForbiddenError } = await import("@yume-chan/adb");
        if (error instanceof AdbFrameBufferForbiddenError) {
          throw createDeviceOpError(
            "captureScreenshot",
            "unsupported",
            "当前设备不支持通过 ADB framebuffer 捕获截图。",
          );
        }

        throw createDeviceOpError(
          "captureScreenshot",
          "failed",
          error instanceof Error ? error.message : "通过 ADB 捕获截图失败。",
        );
      }
    },
  } satisfies AndroidDeviceOps;
}

function parseInvokeError(value: unknown): InvokeErrorShape | null {
  const record = asRecord(value);
  if (record == null) {
    return null;
  }
  return {
    code: asString(record.code).trim(),
    message: asString(record.message).trim(),
    retryable: record.retryable === true,
  };
}

function parseInvokeResponse(value: unknown) {
  const record = asRecord(value);
  if (record == null) {
    throw new Error("invalid invoke response");
  }
  const payload = asRecord(record.payload);
  if (payload == null) {
    throw new Error("invalid invoke payload");
  }
  const result = asRecord(payload.result);
  const resource = asRecord(result?.resource);

  return {
    ok: payload.ok === true,
    error: parseInvokeError(payload.error),
    resource:
      resource == null
        ? null
        : {
            kind: asString(resource.kind).trim() || "resource_ref",
            resourceId: asString(resource.resource_id).trim(),
            leaseId: asString(resource.lease_id).trim(),
            resourceGeneration: asNumber(resource.resource_generation),
          },
  };
}

async function invokeAdbSessionEnsure(params: {
  address: string;
  forceTakeover?: boolean;
  node: BrowserNodeLike;
  peerId: string;
}) {
  const stream = await openStreamForAddress({
    node: params.node,
    address: params.address,
    protocol: INVOKE_PROTOCOL,
  });
  try {
    await writeJsonRequest(stream, {
      v: 1,
      op: "invoke.req",
      request_id: `adb-session-ensure-${params.peerId}-${Date.now()}`,
      timeout_ms: 60_000,
      payload: {
        command: "adb.session.ensure",
        params: params.forceTakeover === true ? { force_takeover: true } : undefined,
      },
    });
    const response = parseInvokeResponse((await readJsonFrame(stream)).payload);
    if (!response.ok || response.resource == null) {
      throw new WorkerControlRequestError(response.error?.message || "adb.session.ensure failed", {
        code: response.error?.code,
        retryable: response.error?.retryable,
      });
    }
    if (response.resource.resourceId === "" || response.resource.leaseId === "") {
      throw new WorkerControlRequestError("adb.session.ensure returned invalid resource ref", {
        code: "SB_BAD_FRAME",
        retryable: false,
      });
    }
    return response.resource;
  } finally {
    await stream.close().catch(() => undefined);
  }
}

async function invokeAdbSessionStop(params: {
  address: string;
  node: BrowserNodeLike;
  peerId: string;
  resource: AdbResourceRef;
}) {
  const stream = await openStreamForAddress({
    node: params.node,
    address: params.address,
    protocol: INVOKE_PROTOCOL,
  });
  try {
    await writeJsonRequest(stream, {
      v: 1,
      op: "invoke.req",
      request_id: `adb-session-stop-${params.peerId}-${Date.now()}`,
      timeout_ms: 30_000,
      payload: {
        command: "adb.session.stop",
        params: {
          resource_id: params.resource.resourceId,
          lease_id: params.resource.leaseId,
          resource_generation: params.resource.resourceGeneration,
          if_not_running: "ok",
        },
      },
    });
    await readJsonFrame(stream);
  } finally {
    await stream.close().catch(() => undefined);
  }
}

function normalizeRemoteControlState(deviceStatus: DeviceStatus | undefined) {
  return deviceStatus?.remoteControl as RemoteControlState | undefined;
}

function shouldForceTakeoverActiveController(deviceStatus: DeviceStatus | undefined, controllerPeerId: string) {
  const remoteControl = normalizeRemoteControlState(deviceStatus);
  if (remoteControl == null) {
    return false;
  }
  const controllerState = remoteControl.session.controllerState?.trim().toLowerCase() ?? "";
  if (controllerState !== "occupied") {
    return false;
  }
  const activeControllerPeerId = remoteControl.session.activeControllerPeerId?.trim() ?? "";
  return activeControllerPeerId !== "" && activeControllerPeerId === controllerPeerId;
}

function isOccupiedByAnotherController(deviceStatus: DeviceStatus | undefined, controllerPeerId: string) {
  const remoteControl = normalizeRemoteControlState(deviceStatus);
  if (remoteControl == null) {
    return false;
  }
  const controllerState = remoteControl.session.controllerState?.trim().toLowerCase() ?? "";
  if (controllerState !== "occupied") {
    return false;
  }
  const activeControllerPeerId = remoteControl.session.activeControllerPeerId?.trim() ?? "";
  return activeControllerPeerId === "" || activeControllerPeerId !== controllerPeerId;
}

function assertDeviceCanStartScrcpy(params: {
  allowTakeover?: boolean;
  deviceStatus: DeviceStatus | undefined;
  controllerPeerId: string;
}) {
  const remoteControl = normalizeRemoteControlState(params.deviceStatus);
  if (remoteControl == null || (remoteControl.platform?.trim().toLowerCase() ?? "") !== "android") {
    throw new AndroidScrcpySessionError("当前节点不支持 Android scrcpy 远控", "unsupported");
  }

  const adbState = remoteControl.capabilities.adbTunnel.state?.trim().toLowerCase() ?? "";
  const scrcpyState = remoteControl.capabilities.scrcpy.state?.trim().toLowerCase() ?? "";
  const scrcpyReason = remoteControl.capabilities.scrcpy.reason?.trim().toLowerCase() ?? "";

  if (adbState !== "available") {
    throw new AndroidScrcpySessionError("当前节点 ADB 通道不可用", "unsupported");
  }
  if (scrcpyReason === "unsupported" || scrcpyState === "unavailable") {
    throw new AndroidScrcpySessionError("当前节点不支持 scrcpy", "unsupported");
  }

  const controllerState = remoteControl.session.controllerState;
  if (controllerState === "occupied") {
    const activePeerId = remoteControl.session.activeControllerPeerId?.trim() ?? "";
    if (params.allowTakeover === true) {
      return;
    }
    if (activePeerId === "" || activePeerId !== params.controllerPeerId) {
      throw new AndroidScrcpySessionError("当前控制会话已被占用", "busy");
    }
  }
}

function mapToSessionError(error: unknown) {
  if (error instanceof AndroidScrcpySessionError) {
    return error;
  }
  if (error instanceof Error && error.name === "AdbScrcpyExitedError") {
    const exitedError = error as unknown as { output?: unknown };
    const output = Array.isArray(exitedError.output)
      ? exitedError.output
          .map((item) => (typeof item === "string" ? item.trim() : ""))
          .filter((item) => item !== "")
          .join(" | ")
      : "";
    return new AndroidScrcpySessionError(
      output ? `scrcpy server exited prematurely: ${output}` : error.message,
      "error",
    );
  }
  if (error instanceof WorkerControlRequestError && error.code === "SB_RESOURCE_BUSY") {
    return new AndroidScrcpySessionError(error.message || "当前控制会话已被占用", "busy");
  }
  if (error instanceof WorkerControlRequestError && error.code === "SB_CAPABILITY_UNAVAILABLE") {
    return new AndroidScrcpySessionError(error.message || "当前节点不支持 Android scrcpy 远控", "unsupported");
  }
  if (error instanceof Error) {
    return new AndroidScrcpySessionError(error.message, "error");
  }
  return new AndroidScrcpySessionError("无法建立 Android scrcpy 会话", "error");
}

function withSessionStep(step: string, error: unknown) {
  if (error instanceof AndroidScrcpySessionError) {
    return error;
  }
  if (error instanceof Error) {
    return new Error(`${step}: ${error.message}`);
  }
  return new Error(`${step}: ${String(error)}`);
}

async function withStepTimeout<T>(step: string, operation: Promise<T>) {
  const timeoutMs = CONNECT_STEP_TIMEOUT_OVERRIDES_MS[step] ?? DEFAULT_CONNECT_STEP_TIMEOUT_MS;
  return await Promise.race([
    operation,
    new Promise<T>((_, reject) => {
      globalThis.setTimeout(() => reject(new Error(`${step} timeout after ${timeoutMs}ms`)), timeoutMs);
    }),
  ]);
}

function isTransientOpeningError(error: unknown) {
  const message = error instanceof Error ? error.message : String(error);
  const normalized = message.trim().toLowerCase();
  return (
    normalized.includes("stale adb session lease or generation") ||
    normalized.includes('the connection muxer is "closed" and not "open"') ||
    normalized.includes('connection muxer is "closed" and not "open"') ||
    normalized.includes("failed to connect via relay with status connection_failed") ||
    normalized.includes("remote closed connection during opening") ||
    normalized.includes("exactreadable ended") ||
    normalized.includes("the stream has been reset") ||
    normalized.includes("stream has been reset")
  );
}

async function getDeviceStatusWithRetry(
  deps: AndroidScrcpySessionServiceDeps,
  params: Pick<CreateAndroidScrcpySessionServiceParams, "address" | "node" | "peerId">,
) {
  let firstError: unknown = null;
  for (let attempt = 0; attempt <= TRANSIENT_ADB_SESSION_RETRY_DELAYS_MS.length; attempt += 1) {
    try {
      return await deps.getDeviceStatus({
        address: params.address,
        node: params.node,
        peerId: params.peerId,
      });
    } catch (error) {
      if (isTransientOpeningError(error) && attempt < TRANSIENT_ADB_SESSION_RETRY_DELAYS_MS.length) {
        firstError ??= error;
        await new Promise((resolve) => globalThis.setTimeout(resolve, TRANSIENT_ADB_SESSION_RETRY_DELAYS_MS[attempt]));
        continue;
      }
      throw firstError ?? error;
    }
  }
  throw firstError ?? new Error("device.status retry exhausted");
}

async function ensureAdbSessionWithRetry(
  deps: AndroidScrcpySessionServiceDeps,
  params: Pick<CreateAndroidScrcpySessionServiceParams, "address" | "node" | "peerId"> & { forceTakeover?: boolean },
) {
  let firstError: unknown = null;
  for (let attempt = 0; attempt <= TRANSIENT_ADB_SESSION_RETRY_DELAYS_MS.length; attempt += 1) {
    try {
      return await deps.ensureAdbSession({
        address: params.address,
        forceTakeover: params.forceTakeover,
        node: params.node,
        peerId: params.peerId,
      });
    } catch (error) {
      if (isTransientOpeningError(error) && attempt < TRANSIENT_ADB_SESSION_RETRY_DELAYS_MS.length) {
        firstError = error;
        await new Promise((resolve) => globalThis.setTimeout(resolve, TRANSIENT_ADB_SESSION_RETRY_DELAYS_MS[attempt]));
        continue;
      }
      throw firstError ?? error;
    }
  }
  throw firstError ?? new Error("adb.session.ensure retry exhausted");
}

async function defaultAttachAdb(params: { transport: OpenAdbTransportResult }): Promise<AttachedAdbHandle> {
  const { Adb, AdbDaemonTransport } = await import("@yume-chan/adb");
  const transport = await AdbDaemonTransport.authenticate({
    serial: "gomtm-android-loopback",
    connection: createAdbDaemonConnection(params.transport),
    credentialStore: createPersistentAdbCredentialStore(),
  });
  const adb = new Adb(transport);
  void adb.disconnected.catch(() => undefined);
  return {
    adb,
    close: async () => {
      await adb.close().catch(() => undefined);
    },
  };
}

type StoredAdbPrivateKey = {
  bufferBase64: string;
  name?: string;
};

type StoredAdbPrivateKeyShape = {
  keys: StoredAdbPrivateKey[];
};

function encodeBase64(bytes: Uint8Array) {
  let binary = "";
  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }
  return btoa(binary);
}

function decodeBase64(value: string) {
  const binary = atob(value);
  return Uint8Array.from(binary, (char) => char.charCodeAt(0));
}

function createPersistentAdbCredentialStore() {
  let cache: Array<{ buffer: Uint8Array; name?: string }> | null = null;

  const load = () => {
    if (cache != null) {
      return cache;
    }
    try {
      const raw = globalThis.localStorage?.getItem(ADB_CREDENTIAL_STORAGE_KEY);
      if (!raw) {
        cache = [];
        return cache;
      }
      const parsed = JSON.parse(raw) as StoredAdbPrivateKeyShape;
      cache = Array.isArray(parsed.keys)
        ? parsed.keys
            .filter((item) => typeof item?.bufferBase64 === "string" && item.bufferBase64.trim() !== "")
            .map((item) => ({
              buffer: decodeBase64(item.bufferBase64),
              name: typeof item.name === "string" ? item.name : undefined,
            }))
        : [];
      return cache;
    } catch {
      cache = [];
      return cache;
    }
  };

  const persist = () => {
    try {
      const payload: StoredAdbPrivateKeyShape = {
        keys: load().map((item) => ({
          bufferBase64: encodeBase64(item.buffer),
          name: item.name,
        })),
      };
      globalThis.localStorage?.setItem(ADB_CREDENTIAL_STORAGE_KEY, JSON.stringify(payload));
    } catch {}
  };

  return {
    async generateKey() {
      const keyPair = await crypto.subtle.generateKey(
        {
          name: "RSASSA-PKCS1-v1_5",
          modulusLength: 2048,
          publicExponent: new Uint8Array([1, 0, 1]),
          hash: "SHA-1",
        },
        true,
        ["sign", "verify"],
      );
      const buffer = new Uint8Array(await crypto.subtle.exportKey("pkcs8", keyPair.privateKey));
      const key = {
        buffer,
        name: `gomtm-${Date.now()}`,
      };
      load().push(key);
      persist();
      return key;
    },
    iterateKeys() {
      return load().map((item) => ({
        buffer: item.buffer.slice(),
        name: item.name,
      }));
    },
  };
}

async function loadScrcpyServerBytes() {
  if (scrcpyServerBytesPromise == null) {
    scrcpyServerBytesPromise = (async () => {
      const response = await fetch(SCRCPY_SERVER_PUBLIC_PATH, { cache: "force-cache" });
      if (!response.ok) {
        throw new Error(`load scrcpy server asset failed: ${response.status}`);
      }
      return new Uint8Array(await response.arrayBuffer());
    })();
  }
  return (await scrcpyServerBytesPromise).slice();
}

function createByteStream(bytes: Uint8Array) {
  return new ReadableStream<Uint8Array>({
    start(controller) {
      controller.enqueue(bytes);
      controller.close();
    },
  });
}

async function defaultPrepareScrcpyServer(params: PrepareScrcpySessionParams): Promise<void> {
  const cacheKey = getPreparedScrcpyServerCacheKey(params.workerPeerId);
  if (preparedScrcpyServerCache.has(cacheKey)) {
    return;
  }
  const [{ AdbScrcpyClient }, { DefaultServerPath }] = await Promise.all([
    import("@yume-chan/adb-scrcpy"),
    import("@yume-chan/scrcpy"),
  ]);
  const serverBytes = await loadScrcpyServerBytes();
  await AdbScrcpyClient.pushServer(params.adb as never, createByteStream(serverBytes) as never, DefaultServerPath);
  preparedScrcpyServerCache.add(cacheKey);
}

async function defaultStartScrcpySession(params: StartScrcpySessionParams): Promise<AndroidScrcpyHandle> {
  const [{ AdbScrcpyClient, AdbScrcpyOptionsLatest }, { ScrcpyOptionsLatest, DefaultServerPath }] = await Promise.all([
    import("@yume-chan/adb-scrcpy"),
    import("@yume-chan/scrcpy"),
  ]);
  const tuning = resolveAndroidScrcpyPerformanceTuning(params.profile);

  const scrcpyOptions = new ScrcpyOptionsLatest({
    control: true,
    video: true,
    videoCodec: "h264",
    scid: params.scid,
    maxSize: tuning.maxSize,
    maxFps: tuning.maxFps,
    videoBitRate: tuning.videoBitRate,
    audio: false,
  });
  const options = new AdbScrcpyOptionsLatest(scrcpyOptions.value, { version: SCRCPY_SERVER_VERSION });

  const client = await AdbScrcpyClient.start(params.adb as never, DefaultServerPath, options);
  let closed = false;
  const outputReader = client.output.getReader();
  const outputDrain = (async () => {
    try {
      while (true) {
        const { done } = await outputReader.read();
        if (done) {
          return;
        }
      }
    } catch {
      // scrcpy output 仅用于避免 subprocess 输出阻塞底层 ADB 多路复用。
    }
  })();

  return {
    close: async () => {
      if (closed) {
        return;
      }
      closed = true;
      await client.close();
      await outputReader.cancel().catch(() => undefined);
      await outputDrain.catch(() => undefined);
    },
    controller: client.controller,
    videoStream: client.videoStream,
  };
}

export function createAndroidScrcpySessionService(params: CreateAndroidScrcpySessionServiceParams) {
  const profile = params.profile ?? "medium";
  const deps: AndroidScrcpySessionServiceDeps = {
    getDeviceStatus: async (input) => (await invokeDeviceStatus(input)).deviceStatus,
    ensureAdbSession: invokeAdbSessionEnsure,
    stopAdbSession: invokeAdbSessionStop,
    openTransport: async (input) =>
      openAdbTransport({
        address: input.address,
        node: input.node,
        peerId: input.peerId,
        resource: input.resource,
      }),
    attachAdb: async (input) => defaultAttachAdb({ transport: input.transport }),
    prepareScrcpyServer: async (input) => defaultPrepareScrcpyServer(input),
    startScrcpySession: async (input) => defaultStartScrcpySession(input),
    createDeviceOps: async (input) => defaultCreateDeviceOps(input),
    ...params.deps,
  };

  let snapshot: AndroidScrcpySessionSnapshot = { profile, status: "idle" };
  let current: AndroidScrcpyLiveSession | null = null;

  const setSnapshot = (next: AndroidScrcpySessionSnapshot) => {
    snapshot = {
      profile,
      ...next,
    };
  };

  const closeCurrent = async (stopResource: boolean) => {
    if (current == null) {
      return;
    }
    const active = current;
    logAndroidScrcpySession("closeCurrent:start", {
      peerId: params.peerId,
      sessionId: active.sessionId,
      stopResource,
      workerPeerId: params.workerPeerId,
    });
    current = null;
    active.stopHeartbeat?.();
    clearPreparedScrcpyServer(params.workerPeerId);

    await active.scrcpy.close().catch(() => undefined);
    await active.adb.close().catch(() => undefined);
    await active.transport.close().catch(() => undefined);
    if (stopResource) {
      logAndroidScrcpySession("closeCurrent:stopAdbSession", {
        peerId: params.peerId,
        sessionId: active.sessionId,
        workerPeerId: params.workerPeerId,
      });
      await deps
        .stopAdbSession({
          address: params.address,
          node: params.node,
          peerId: params.peerId,
          resource: active.resource,
        })
        .catch(() => undefined);
    }
    logAndroidScrcpySession("closeCurrent:done", {
      peerId: params.peerId,
      sessionId: active.sessionId,
      stopResource,
      workerPeerId: params.workerPeerId,
    });
  };

  const restartScrcpy = async () => {
    if (current == null) {
      throw new AndroidScrcpySessionError("当前没有可恢复的 Android scrcpy 会话", "error");
    }

    const active = current;
    logAndroidScrcpySession("restartScrcpy:start", {
      peerId: params.peerId,
      sessionId: active.sessionId,
      workerPeerId: params.workerPeerId,
    });
    const scrcpySocketID = Math.floor(Math.random() * 0x7fffffff)
      .toString(16)
      .padStart(8, "0");
    setSnapshot({
      status: "reconnecting",
      message: "正在恢复 scrcpy 视频流...",
    });
    clearPreparedScrcpyServer(params.workerPeerId);
    await active.scrcpy.close().catch(() => undefined);

    try {
      await deps.prepareScrcpyServer({
        adb: active.adb.adb,
        address: params.address,
        node: params.node,
        peerId: params.peerId,
        workerPeerId: params.workerPeerId,
      });
      const scrcpy = await deps.startScrcpySession({
        adb: active.adb.adb,
        address: params.address,
        node: params.node,
        peerId: params.peerId,
        profile,
        scid: scrcpySocketID,
        workerPeerId: params.workerPeerId,
      });
      const deviceOps = await Promise.resolve(
        deps.createDeviceOps({
          adb: active.adb.adb,
          scrcpy,
        }),
      );
      if (current?.sessionId !== active.sessionId) {
        await scrcpy.close().catch(() => undefined);
        throw new AndroidScrcpySessionError("当前 Android scrcpy 会话已失效，请重新连接。", "error");
      }
      active.scrcpy = scrcpy;
      active.deviceOps = deviceOps;
      setSnapshot({
        connectElapsedMs: 0,
        status: "connected",
        sessionId: active.sessionId,
      });
      logAndroidScrcpySession("restartScrcpy:connected", {
        peerId: params.peerId,
        sessionId: active.sessionId,
        workerPeerId: params.workerPeerId,
      });
      return active;
    } catch (cause) {
      clearPreparedScrcpyServer(params.workerPeerId);
      const error = mapToSessionError(cause);
      setSnapshot({
        status: error.code === "busy" ? "busy" : error.code === "unsupported" ? "unsupported" : "error",
        message: error.message,
      });
      logAndroidScrcpySession("restartScrcpy:error", {
        error: error.message,
        peerId: params.peerId,
        sessionId: active.sessionId,
        workerPeerId: params.workerPeerId,
      });
      throw error;
    }
  };

  const openSessionPipeline = async (mode: "connect" | "reconnect", allowTakeover: boolean) => {
    const startedAt = Date.now();
    let openingTransport: OpenAdbTransportResult | null = null;
    let openingAdb: AttachedAdbHandle | null = null;
    let openingScrcpy: AndroidScrcpyHandle | null = null;
    let openingResource: AdbResourceRef | null = null;
    const scrcpySocketID = Math.floor(Math.random() * 0x7fffffff)
      .toString(16)
      .padStart(8, "0");

    const runOpeningStep = async <T>(step: string, message: string, operation: () => Promise<T>) => {
      setSnapshot({ status: "connecting", message });
      try {
        return await withStepTimeout(step, operation());
      } catch (error) {
        throw withSessionStep(step, error);
      }
    };

    try {
      logAndroidScrcpySession("openSessionPipeline:start", {
        allowTakeover,
        mode,
        peerId: params.peerId,
        workerPeerId: params.workerPeerId,
      });
      const deviceStatus = await runOpeningStep("device.status", "正在读取目标节点能力...", () =>
        getDeviceStatusWithRetry(deps, {
          address: params.address,
          node: params.node,
          peerId: params.peerId,
        }),
      );
      const forceTakeover =
        shouldForceTakeoverActiveController(deviceStatus, params.peerId) ||
        (allowTakeover && mode === "reconnect" && isOccupiedByAnotherController(deviceStatus, params.peerId));
      assertDeviceCanStartScrcpy({
        allowTakeover: forceTakeover,
        deviceStatus,
        controllerPeerId: params.peerId,
      });

      const resource = await runOpeningStep("ensure adb session", "正在确保 ADB 会话...", () =>
        ensureAdbSessionWithRetry(deps, {
          address: params.address,
          forceTakeover,
          node: params.node,
          peerId: params.peerId,
        }),
      );
      openingResource = resource;

      const transport = await runOpeningStep("open adb transport", "正在打开 ADB 隧道...", () =>
        deps.openTransport({
          address: params.address,
          node: params.node,
          peerId: params.workerPeerId,
          resource,
        }),
      );
      openingTransport = transport;

      const adb = await runOpeningStep("attach adb daemon", "正在附着 ADB daemon...", () =>
        deps.attachAdb({
          address: params.address,
          node: params.node,
          peerId: params.peerId,
          workerPeerId: params.workerPeerId,
          transport,
          resource,
        }),
      );
      openingAdb = adb;

      await runOpeningStep("prepare scrcpy server", "正在下发 scrcpy server...", () =>
        deps.prepareScrcpyServer({
          adb: adb.adb,
          address: params.address,
          node: params.node,
          peerId: params.peerId,
          workerPeerId: params.workerPeerId,
        }),
      );

      const scrcpy = await runOpeningStep("start scrcpy session", "正在启动 scrcpy 会话...", () =>
        deps.startScrcpySession({
          adb: adb.adb,
          address: params.address,
          node: params.node,
          peerId: params.peerId,
          profile,
          scid: scrcpySocketID,
          workerPeerId: params.workerPeerId,
        }),
      );
      openingScrcpy = scrcpy;

      const deviceOps = await runOpeningStep("initialize device operations", "正在初始化设备动作...", () =>
        Promise.resolve(
          deps.createDeviceOps({
            adb: adb.adb,
            scrcpy,
          }),
        ),
      );
      const sessionId = `android-scrcpy-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
      current = {
        sessionId,
        resource,
        transport,
        adb,
        deviceOps,
        scrcpy,
      };

      setSnapshot({
        connectElapsedMs: Math.max(0, Date.now() - startedAt),
        status: "connected",
        sessionId,
      });
      logAndroidScrcpySession("openSessionPipeline:connected", {
        connectElapsedMs: Math.max(0, Date.now() - startedAt),
        mode,
        peerId: params.peerId,
        sessionId,
        workerPeerId: params.workerPeerId,
      });
      return current;
    } catch (cause) {
      await openingScrcpy?.close().catch(() => undefined);
      await openingAdb?.close().catch(() => undefined);
      await openingTransport?.close().catch(() => undefined);
      if (openingResource != null) {
        await deps
          .stopAdbSession({
            address: params.address,
            node: params.node,
            peerId: params.peerId,
            resource: openingResource,
          })
          .catch(() => undefined);
      }

      const error = mapToSessionError(cause);
      if (error.message.includes("scrcpy server exited prematurely")) {
        clearPreparedScrcpyServer(params.workerPeerId);
      }
      setSnapshot({
        status: error.code === "busy" ? "busy" : error.code === "unsupported" ? "unsupported" : "error",
        message: error.message,
      });
      logAndroidScrcpySession("openSessionPipeline:error", {
        error: error.message,
        mode,
        peerId: params.peerId,
        workerPeerId: params.workerPeerId,
      });
      throw error;
    }
  };

  const connectWithTransientRetry = async (mode: "connect" | "reconnect", allowTakeover: boolean) => {
    let firstError: unknown = null;
    for (let attempt = 0; attempt <= TRANSIENT_ADB_SESSION_RETRY_DELAYS_MS.length; attempt += 1) {
      try {
        return await openSessionPipeline(mode, allowTakeover);
      } catch (error) {
        if (!isTransientOpeningError(error) || attempt >= TRANSIENT_ADB_SESSION_RETRY_DELAYS_MS.length) {
          throw firstError ?? error;
        }
        firstError ??= error;
        setSnapshot({ status: "connecting" });
        await new Promise((resolve) => globalThis.setTimeout(resolve, TRANSIENT_ADB_SESSION_RETRY_DELAYS_MS[attempt]));
      }
    }
    throw firstError ?? new AndroidScrcpySessionError("无法建立 Android scrcpy 会话", "error");
  };

  const connect = async () => {
    if (current != null) {
      logAndroidScrcpySession("connect:reuse-current", {
        peerId: params.peerId,
        sessionId: current.sessionId,
        workerPeerId: params.workerPeerId,
      });
      return current;
    }

    setSnapshot({ status: "connecting" });
    logAndroidScrcpySession("connect:start", {
      peerId: params.peerId,
      workerPeerId: params.workerPeerId,
    });
    return connectWithTransientRetry("connect", false);
  };

  const reconnect = async (options?: { allowTakeover?: boolean }) => {
    setSnapshot({ status: "reconnecting" });
    logAndroidScrcpySession("reconnect:start", {
      allowTakeover: options?.allowTakeover === true,
      peerId: params.peerId,
      workerPeerId: params.workerPeerId,
    });
    await closeCurrent(true);
    return connectWithTransientRetry("reconnect", options?.allowTakeover === true);
  };

  const close = async () => {
    logAndroidScrcpySession("close:start", {
      peerId: params.peerId,
      workerPeerId: params.workerPeerId,
    });
    await closeCurrent(true);
    setSnapshot({ status: "closed" });
    logAndroidScrcpySession("close:done", {
      peerId: params.peerId,
      workerPeerId: params.workerPeerId,
    });
  };

  return {
    connect,
    reconnect,
    restartScrcpy,
    close,
    getSnapshot: () => snapshot,
    getLiveSession: () => current,
  };
}
