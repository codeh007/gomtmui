export type CapabilityState = {
  state?: string;
  reason?: string;
};

export type ConnectionPathObservation = {
  connectionPeerId?: string;
  path?: "direct" | "relay";
  viaAddr?: string;
};

export type RemoteControlCapabilityState = CapabilityState;

export type RemoteControlCapabilities = {
  nativeRemoteV2WebRTC?: RemoteControlCapabilityState;
};

export type RemoteControlState = {
  capabilities: RemoteControlCapabilities;
};

export type PeerCapabilityTruth = {
  connectionPath?: ConnectionPathObservation;
  remoteControl?: RemoteControlState;
  platform?: string;
};

export type DeviceStatus = PeerCapabilityTruth & {
  runtimeStatus?: string;
  lastError?: string;
};

function hasCapabilityState(value: CapabilityState | undefined) {
  return (value?.state?.trim() ?? "") !== "";
}

export type PeerCandidate = {
  peerId: string;
  multiaddrs: string[];
  lastDiscoveredAt: string;
};

export function getPeerDisplayTitle(peer: { peerId?: string | null } | null | undefined) {
  return peer?.peerId?.trim() || "未知节点";
}

function asRecord(value: unknown) {
  return value !== null && typeof value === "object" ? (value as Record<string, unknown>) : null;
}

function asString(value: unknown) {
  return typeof value === "string" ? value : "";
}

function parseRemoteControlCapabilityState(value: unknown): CapabilityState {
  const record = asRecord(value) ?? {};
  return {
    state: asString(record.state).trim() || undefined,
    reason: asString(record.reason).trim() || undefined,
  };
}

function parseConnectionPathObservation(value: unknown): ConnectionPathObservation | undefined {
  const record = asRecord(value);
  if (record == null) {
    return undefined;
  }

  const path = asString(record.path).trim().toLowerCase();
  if (path !== "direct" && path !== "relay") {
    return undefined;
  }

  return {
    connectionPeerId: asString(record.connection_peer_id).trim() || undefined,
    path,
    viaAddr: asString(record.via_addr).trim() || undefined,
  };
}

export function parseCapabilityState(value: unknown): CapabilityState | undefined {
  const record = asRecord(value);
  if (record == null) {
    return undefined;
  }
  return {
    state: asString(record.state).trim() || undefined,
    reason: asString(record.reason).trim() || undefined,
  };
}

export function parseDeviceStatus(value: unknown): DeviceStatus | undefined {
  const record = asRecord(value);
  if (record == null) {
    return undefined;
  }

  return {
    connectionPath: parseConnectionPathObservation(record.connection_path),
    platform: asString(record.platform).trim() || undefined,
    remoteControl: parseRemoteControlState(record.remote_control),
    runtimeStatus: asString(record.runtime_status).trim() || undefined,
    lastError: asString(record.last_error).trim() || undefined,
  };
}

export function toPeerCapabilityTruth(status: DeviceStatus | null | undefined): PeerCapabilityTruth | null {
  if (status == null) {
    return null;
  }

  const truth: PeerCapabilityTruth = {
    connectionPath: status.connectionPath,
    remoteControl: status.remoteControl,
    platform: status.platform,
  };

  if (truth.connectionPath == null && truth.remoteControl == null) {
    return null;
  }

  return truth;
}

export function parseRemoteControlState(value: unknown): RemoteControlState | undefined {
  const record = asRecord(value);
  if (record == null) {
    return undefined;
  }
  const platform = asString(record.platform).trim().toLowerCase();
  if (platform !== "android") {
    return undefined;
  }
  const capabilitiesRecord = asRecord(record.capabilities) ?? {};

  const nativeRemoteV2WebRTC = parseRemoteControlCapabilityState(capabilitiesRecord.native_remote_v2_webrtc);
  if (!hasCapabilityState(nativeRemoteV2WebRTC)) {
    return undefined;
  }

  return {
    capabilities: {
      nativeRemoteV2WebRTC,
    },
  };
}

export function canOpenAndroidView(remoteControl: RemoteControlState | null | undefined) {
  return (remoteControl?.capabilities.nativeRemoteV2WebRTC?.state?.trim().toLowerCase() ?? "") === "available";
}
