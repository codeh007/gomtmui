import {
  type PeerCapabilityTruth,
  parseDeviceStatus,
  toPeerCapabilityTruth,
} from "./discovery-contracts";
import { type BrowserNodeLike, openStreamForAddress, readJsonFrame, writeJsonRequest } from "./libp2p-stream";

const DEFAULT_INVOKE_PROTOCOL = "/gomtm/worker-sb/invoke/1.0.0";
const DEFAULT_STREAM_PROTOCOL = "/gomtm/worker-sb/stream/1.0.0";
type RecordShape = Record<string, unknown>;

export class WorkerControlRequestError extends Error {
  code?: string;
  retryable?: boolean;

  constructor(message: string, options: { code?: string; retryable?: boolean } = {}) {
    super(message);
    this.name = "WorkerControlRequestError";
    this.code = options.code?.trim() || undefined;
    this.retryable = typeof options.retryable === "boolean" ? options.retryable : undefined;
    Object.setPrototypeOf(this, WorkerControlRequestError.prototype);
  }
}

type InvokeErrorShape = {
  code: string;
  message: string;
  retryable: boolean;
};

type NativeRemoteV2ResolvedTarget = {
  kind?: string;
  host?: string;
  port?: number;
  protocolHint?: string;
  serviceHint?: string;
};

type NativeRemoteV2ChannelDescriptor = {
  kind?: string;
  framing?: string;
  codec?: string;
  width?: number;
  height?: number;
  rotation?: number;
  keyframeRequiredOnStart?: boolean;
};

export type NativeRemoteV2StreamDescriptor = {
  status?: string;
  resolved?: NativeRemoteV2ResolvedTarget;
  channel?: NativeRemoteV2ChannelDescriptor;
};

export type NativeRemoteV2WebRtcStartPayload = {
  sessionId?: string;
  state?: string;
  topology?: string;
  lastError?: string;
};

type NativeRemoteV2ScreenshotPayload = {
  capturedAt?: string;
  height?: number;
  imageBase64?: string;
  mimeType?: string;
  width?: number;
};

export type NativeRemoteV2VideoPacket = {
  data: Uint8Array;
  keyframe: boolean;
  ptsUs: bigint;
  type: "data";
};

type NativeRemoteV2VideoStream = {
  close: () => Promise<void>;
  metadata: {
    codec?: string;
    height?: number;
    keyframeRequiredOnStart?: boolean;
    rotation?: number;
    width?: number;
  };
  packets: AsyncIterable<NativeRemoteV2VideoPacket>;
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

function toWorkerControlRequestError(error: InvokeErrorShape | null, fallbackMessage: string) {
  return new WorkerControlRequestError(error?.message || fallbackMessage, {
    code: error?.code,
    retryable: error?.retryable,
  });
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

  const errorRecord = asRecord(payload.error);
  const resultRecord = asRecord(payload.result);

  return {
    ok: payload.ok === true,
    error:
      errorRecord == null
        ? null
        : {
            code: asString(errorRecord.code).trim(),
            message: asString(errorRecord.message).trim(),
            retryable: errorRecord.retryable === true,
          },
    result:
      resultRecord == null
        ? null
        : {
            status: asString(resultRecord.status).trim() || undefined,
            deviceStatus: parseDeviceStatus(resultRecord.device_status),
            remoteControlPayload: parseNativeRemoteV2StreamDescriptor(resultRecord.remote_control_payload),
            remoteControlScreenshotPayload: parseNativeRemoteV2ScreenshotPayload(resultRecord.remote_control_payload),
            remoteControlWebRtcPayload: parseNativeRemoteV2WebRtcStartPayload(resultRecord.remote_control_payload),
          },
  };
}

function parseNativeRemoteResolvedTarget(value: unknown): NativeRemoteV2ResolvedTarget | undefined {
  const record = asRecord(value);
  if (record == null) {
    return undefined;
  }

  return {
    kind: asString(record.kind).trim() || undefined,
    host: asString(record.host).trim() || undefined,
    port: asNumber(record.port) || undefined,
    protocolHint: asString(record.protocol_hint).trim() || undefined,
    serviceHint: asString(record.service_hint).trim() || undefined,
  };
}

function parseNativeRemoteChannel(value: unknown): NativeRemoteV2ChannelDescriptor | undefined {
  const record = asRecord(value);
  if (record == null) {
    return undefined;
  }

  return {
    kind: asString(record.kind).trim() || undefined,
    framing: asString(record.framing).trim() || undefined,
    codec: asString(record.codec).trim() || undefined,
    width: asNumber(record.width) || undefined,
    height: asNumber(record.height) || undefined,
    rotation: typeof record.rotation === "number" && Number.isFinite(record.rotation) ? record.rotation : undefined,
    keyframeRequiredOnStart: record.keyframe_required_on_start === true,
  };
}

function hasUsableNativeRemoteResolvedTarget(value: NativeRemoteV2ResolvedTarget | undefined) {
  return (
    value != null &&
    [value.kind, value.host, value.port, value.protocolHint, value.serviceHint].some(
      (field) => field != null && field !== "",
    )
  );
}

function hasUsableNativeRemoteChannel(value: NativeRemoteV2ChannelDescriptor | undefined) {
  return (
    value != null &&
    [
      value.kind,
      value.framing,
      value.codec,
      value.width,
      value.height,
      value.rotation,
      value.keyframeRequiredOnStart,
    ].some((field) => field != null && field !== "")
  );
}

function hasUsableNativeRemoteV2StreamDescriptor(value: NativeRemoteV2StreamDescriptor | undefined) {
  return (
    value != null &&
    (hasUsableNativeRemoteResolvedTarget(value.resolved) || hasUsableNativeRemoteChannel(value.channel))
  );
}

function parseNativeRemoteV2StreamDescriptor(value: unknown): NativeRemoteV2StreamDescriptor | undefined {
  const record = asRecord(value);
  if (record == null) {
    return undefined;
  }

  const descriptor = {
    status: asString(record.status).trim() || undefined,
    resolved: parseNativeRemoteResolvedTarget(record.resolved),
    channel: parseNativeRemoteChannel(record.channel),
  };
  return hasUsableNativeRemoteV2StreamDescriptor(descriptor) ? descriptor : undefined;
}

function parseNativeRemoteV2WebRtcStartPayload(value: unknown): NativeRemoteV2WebRtcStartPayload | undefined {
  const record = asRecord(value);
  if (record == null) {
    return undefined;
  }
  const sessionId = asString(record.session_id).trim() || undefined;
  const state = asString(record.state).trim() || undefined;
  const topology = asString(record.topology).trim() || undefined;
  const lastError = asString(record.last_error).trim() || undefined;
  if ([sessionId, state, topology, lastError].every((field) => field == null || field === "")) {
    return undefined;
  }
  return {
    sessionId,
    state,
    topology,
    lastError,
  };
}

function parseNativeRemoteV2ScreenshotPayload(value: unknown): NativeRemoteV2ScreenshotPayload | undefined {
  const record = asRecord(value);
  if (record == null) {
    return undefined;
  }
  const mimeType = asString(record.mime_type).trim() || undefined;
  const imageBase64 = asString(record.image_base64).trim() || undefined;
  const width = asNumber(record.width) || undefined;
  const height = asNumber(record.height) || undefined;
  const capturedAt = asString(record.captured_at).trim() || undefined;
  if ([mimeType, imageBase64, width, height, capturedAt].every((field) => field == null || field === "")) {
    return undefined;
  }
  return {
    capturedAt,
    height,
    imageBase64,
    mimeType,
    width,
  };
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
  return {
    ok: payload.ok === true,
    error:
      errorRecord == null
        ? null
        : {
            code: asString(errorRecord.code).trim(),
            message: asString(errorRecord.message).trim(),
            retryable: errorRecord.retryable === true,
          },
  };
}

async function* decodeLengthPrefixedSource(source: AsyncIterable<Uint8Array>) {
  let buffered = new Uint8Array(0);

  for await (const chunk of source) {
    const merged = new Uint8Array(buffered.length + chunk.length);
    merged.set(buffered, 0);
    merged.set(chunk, buffered.length);
    buffered = merged;

    while (buffered.length >= 4) {
      const frameLength = new DataView(buffered.buffer, buffered.byteOffset, buffered.byteLength).getUint32(0);
      if (buffered.length < frameLength + 4) {
        break;
      }
      const payload = buffered.slice(4, frameLength + 4);
      buffered = buffered.slice(frameLength + 4);
      yield payload;
    }
  }
}

async function* decodeNativeRemoteV2VideoPackets(source: AsyncIterable<Uint8Array>) {
  const decoder = new TextDecoder();
  const framedSource = decodeLengthPrefixedSource(source);
  while (true) {
    const headerChunk = await framedSource.next();
    if (headerChunk.done) {
      return;
    }
    const payloadChunk = await framedSource.next();
    if (payloadChunk.done) {
      return;
    }
    const headerRecord = asRecord(JSON.parse(decoder.decode(headerChunk.value)));
    const ptsValue = headerRecord?.pts_us;
    const ptsUs = typeof ptsValue === "number" && Number.isFinite(ptsValue) ? BigInt(Math.trunc(ptsValue)) : 0n;
    yield {
      data: payloadChunk.value,
      keyframe: headerRecord?.is_keyframe === true,
      ptsUs,
      type: "data" as const,
    };
  }
}

type WorkerInvokeParams = {
  address: string;
  node: BrowserNodeLike;
  peerId: string;
  command: string;
  requestIdPrefix: string;
  timeoutMs: number;
  params?: RecordShape;
};

async function invokeWorkerCommand(params: WorkerInvokeParams) {
  const stream = await openStreamForAddress({
    node: params.node,
    address: params.address,
    protocol: DEFAULT_INVOKE_PROTOCOL,
  });
  try {
    await writeJsonRequest(stream, {
      v: 1,
      op: "invoke.req",
      request_id: `${params.requestIdPrefix}-${params.peerId}-${Date.now()}`,
      timeout_ms: params.timeoutMs,
      payload: {
        command: params.command,
        params: params.params,
      },
    });
    const response = parseInvokeResponse((await readJsonFrame(stream)).payload);
    if (!response.ok || response.result == null) {
      throw toWorkerControlRequestError(response.error, `${params.command} failed`);
    }
    return response.result;
  } finally {
    await stream.close().catch(() => undefined);
  }
}

async function invokeDeviceStatus(params: { address: string; node: BrowserNodeLike; peerId: string }) {
  return invokeWorkerCommand({
    ...params,
    command: "device.status",
    requestIdPrefix: "device-status",
    timeoutMs: 10_000,
  });
}

export async function requestPeerCapabilityTruth(params: {
  address: string;
  node: BrowserNodeLike;
  peerId: string;
}): Promise<PeerCapabilityTruth> {
  const result = await invokeDeviceStatus(params);
  const truth = toPeerCapabilityTruth(result.deviceStatus);
  if (truth == null) {
    throw new WorkerControlRequestError("device.status returned no peer capability truth", {
      code: "SB_BAD_FRAME",
      retryable: false,
    });
  }
  return truth;
}

export async function ensureNativeRemoteV2Stream(params: { address: string; node: BrowserNodeLike; peerId: string }) {
  const result = await invokeWorkerCommand({
    ...params,
    command: "screen.stream.ensure",
    requestIdPrefix: "android-native-v2",
    timeoutMs: 10_000,
  });

  if (!hasUsableNativeRemoteV2StreamDescriptor(result.remoteControlPayload)) {
    throw new WorkerControlRequestError("screen.stream.ensure returned no usable remote_control_payload", {
      code: "SB_BAD_FRAME",
      retryable: false,
    });
  }

  return result.remoteControlPayload;
}

export async function openNativeRemoteV2VideoStream(params: {
  address: string;
  descriptor: NativeRemoteV2StreamDescriptor;
  node: BrowserNodeLike;
  peerId: string;
}): Promise<NativeRemoteV2VideoStream> {
  const resolved = params.descriptor.resolved;
  if (resolved?.kind?.trim() !== "loopback_tcp" || !resolved.host || !resolved.port) {
    throw new WorkerControlRequestError("screen.stream.ensure returned no usable loopback target", {
      code: "SB_BAD_FRAME",
      retryable: false,
    });
  }

  const stream = await openStreamForAddress({
    node: params.node,
    address: params.address,
    freshConnection: true,
    protocol: DEFAULT_STREAM_PROTOCOL,
  });

  await writeJsonRequest(stream, {
    v: 1,
    op: "stream.open.req",
    request_id: `native-v2-stream-open-${params.peerId}-${Date.now()}`,
    timeout_ms: 10_000,
    payload: {
      target: {
        host: resolved.host,
        kind: resolved.kind,
        port: resolved.port,
        protocol_hint: resolved.protocolHint,
        service_hint: resolved.serviceHint,
      },
    },
  });

  const response = await readJsonFrame(stream);
  const parsed = parseStreamOpenResponse(response.payload);
  if (!parsed.ok) {
    await stream.close().catch(() => undefined);
    throw toWorkerControlRequestError(parsed.error, "screen stream open failed");
  }

  return {
    close: () => stream.close().catch(() => undefined),
    metadata: {
      codec: params.descriptor.channel?.codec,
      height: params.descriptor.channel?.height,
      keyframeRequiredOnStart: params.descriptor.channel?.keyframeRequiredOnStart,
      rotation: params.descriptor.channel?.rotation,
      width: params.descriptor.channel?.width,
    },
    packets: decodeNativeRemoteV2VideoPackets(response.remainingSource),
  };
}

async function invokeRemoteControlCommand(params: WorkerInvokeParams) {
  return invokeWorkerCommand(params);
}

export async function captureNativeRemoteV2Screenshot(params: {
  address: string;
  format?: string;
  node: BrowserNodeLike;
  peerId: string;
}) {
  const result = await invokeRemoteControlCommand({
    ...params,
    command: "screen.snapshot",
    params: { format: params.format?.trim() || "png" },
    requestIdPrefix: "android-native-v2-snapshot",
    timeoutMs: 10_000,
  });

  if (result.remoteControlScreenshotPayload == null) {
    throw new WorkerControlRequestError("screen.snapshot returned no usable remote_control_payload", {
      code: "SB_BAD_FRAME",
      retryable: false,
    });
  }

  return result.remoteControlScreenshotPayload;
}

export async function invokeNativeRemoteV2Tap(params: {
  address: string;
  node: BrowserNodeLike;
  peerId: string;
  x: number;
  y: number;
}) {
  await invokeRemoteControlCommand({
    ...params,
    command: "input.tap",
    params: { x: params.x, y: params.y },
    requestIdPrefix: "android-native-v2-tap",
    timeoutMs: 10_000,
  });
}

export async function invokeNativeRemoteV2Swipe(params: {
  address: string;
  durationMs?: number;
  endX: number;
  endY: number;
  node: BrowserNodeLike;
  peerId: string;
  startX: number;
  startY: number;
}) {
  await invokeRemoteControlCommand({
    ...params,
    command: "input.swipe",
    params: {
      duration_ms: params.durationMs,
      end_x: params.endX,
      end_y: params.endY,
      start_x: params.startX,
      start_y: params.startY,
    },
    requestIdPrefix: "android-native-v2-swipe",
    timeoutMs: 10_000,
  });
}

export async function invokeNativeRemoteV2Text(params: {
  address: string;
  node: BrowserNodeLike;
  peerId: string;
  text: string;
}) {
  await invokeRemoteControlCommand({
    ...params,
    command: "input.text",
    params: { text: params.text },
    requestIdPrefix: "android-native-v2-text",
    timeoutMs: 10_000,
  });
}

export async function invokeNativeRemoteV2Key(params: {
  address: string;
  key: string;
  node: BrowserNodeLike;
  peerId: string;
}) {
  await invokeRemoteControlCommand({
    ...params,
    command: "input.key",
    params: { key: params.key },
    requestIdPrefix: "android-native-v2-key",
    timeoutMs: 10_000,
  });
}

