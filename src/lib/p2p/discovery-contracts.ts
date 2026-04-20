export type CapabilityState = {
  state?: string;
  reason?: string;
};

export type ConnectionPathObservation = {
  connectionPeerId?: string;
  path?: "direct" | "relay";
  viaAddr?: string;
};

export type PeerCapabilityTruth = {
  connectionPath?: ConnectionPathObservation;
  vnc?: CapabilityState;
  remoteControl?: RemoteControlState;
  platform?: string;
};

export type DeviceStatus = PeerCapabilityTruth & {
  runtimeStatus?: string;
  lastError?: string;
};

export type RemoteControlCapabilityState = {
  state?: string;
  reason?: string;
};

export type RemoteControlCapabilities = {
  nativeRemoteV2WebRTC?: RemoteControlCapabilityState;
};

export type RemoteControlSession = {
  controllerMode: "single_controller";
  controllerState: "idle" | "occupied";
  activeControllerPeerId?: string;
};

export type RemoteControlState = {
  nativeRemoteV2Session?: {
    state?: string;
    lastError?: string;
  };
  nativeRemoteV2WebRTCSession?: {
    state?: string;
    topology?: string;
    sessionId?: string;
    lastError?: string;
  };
  platform?: string;
  capabilities: RemoteControlCapabilities;
  session: RemoteControlSession;
};

function hasCapabilityState(value: RemoteControlCapabilityState | undefined) {
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

function parseRemoteControlCapabilityState(value: unknown): RemoteControlCapabilityState {
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
    vnc: parseCapabilityState(record.vnc),
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
    vnc: status.vnc,
    remoteControl: status.remoteControl,
    platform: status.platform,
  };

  if (truth.connectionPath == null && truth.vnc == null && truth.remoteControl == null) {
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
  const sessionRecord = asRecord(record.session) ?? {};

  const nativeRemoteV2WebRTC = parseRemoteControlCapabilityState(capabilitiesRecord.native_remote_v2_webrtc);
  if (!hasCapabilityState(nativeRemoteV2WebRTC)) {
    return undefined;
  }

  const controllerMode = asString(sessionRecord.controller_mode).trim().toLowerCase();
  const controllerState = asString(sessionRecord.controller_state).trim().toLowerCase();
  if (controllerMode !== "single_controller") {
    return undefined;
  }
  if (controllerState !== "idle" && controllerState !== "occupied") {
    return undefined;
  }

  const activeControllerPeerId = asString(sessionRecord.active_controller_peer_id).trim() || undefined;
  if (controllerState === "occupied" && activeControllerPeerId == null) {
    return undefined;
  }

  return {
    platform: "android",
    capabilities: {
      nativeRemoteV2WebRTC,
    },
    nativeRemoteV2Session: (() => {
      const sessionRecordV2 = asRecord(record.native_remote_v2_session);
      if (sessionRecordV2 == null) {
        return undefined;
      }
      return {
        lastError: asString(sessionRecordV2.last_error).trim() || undefined,
        state: asString(sessionRecordV2.state).trim() || undefined,
      };
    })(),
    nativeRemoteV2WebRTCSession: (() => {
      const sessionRecordV2WebRTC = asRecord(record.native_remote_v2_webrtc_session);
      if (sessionRecordV2WebRTC == null) {
        return undefined;
      }
      return {
        lastError: asString(sessionRecordV2WebRTC.last_error).trim() || undefined,
        sessionId: asString(sessionRecordV2WebRTC.session_id).trim() || undefined,
        state: asString(sessionRecordV2WebRTC.state).trim() || undefined,
        topology: asString(sessionRecordV2WebRTC.topology).trim() || undefined,
      };
    })(),
    session: {
      controllerMode: "single_controller",
      controllerState,
      activeControllerPeerId: controllerState === "occupied" ? activeControllerPeerId : undefined,
    },
  };
}

export function supportsVncView(vnc: CapabilityState | null | undefined) {
  return (vnc?.state?.trim().toLowerCase() ?? "") === "available";
}

export function canOpenAndroidView(remoteControl: RemoteControlState | null | undefined) {
  return (remoteControl?.capabilities.nativeRemoteV2WebRTC?.state?.trim().toLowerCase() ?? "") === "available";
}

export function supportsAndroidRemoteControl(remoteControl: RemoteControlState | null | undefined) {
  return canOpenAndroidView(remoteControl);
}

export function listPeerFeatureLabels(vnc: CapabilityState | null | undefined, remoteControl: RemoteControlState | null | undefined) {
  const labels: string[] = [];
  if (supportsVncView(vnc)) {
    labels.push("vnc");
  }
  if (canOpenAndroidView(remoteControl)) {
    labels.push("android");
  }
  return labels;
}
