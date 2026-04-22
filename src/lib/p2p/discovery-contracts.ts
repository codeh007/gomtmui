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
};

export type PeerCapabilityDescriptor = {
  meta?: Record<string, unknown>;
  name: string;
  reason?: string;
  state?: string;
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
    connectionPeerId: asString(record.connection_peer_id ?? record.connectionPeerId).trim() || undefined,
    path,
    viaAddr: asString(record.via_addr ?? record.viaAddr).trim() || undefined,
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
  };

  if (truth.connectionPath == null && truth.remoteControl == null) {
    return null;
  }

  return truth;
}

export function listPeerCapabilities(truth: PeerCapabilityTruth | null | undefined): PeerCapabilityDescriptor[] {
  const capabilities: PeerCapabilityDescriptor[] = [];
  const nativeRemoteV2WebRTC = truth?.remoteControl?.capabilities.nativeRemoteV2WebRTC;

  if (nativeRemoteV2WebRTC != null && hasCapabilityState(nativeRemoteV2WebRTC)) {
    capabilities.push({
      name: "android.native_remote_v2_webrtc",
      reason: nativeRemoteV2WebRTC.reason,
      state: nativeRemoteV2WebRTC.state,
    });
  }

  return capabilities;
}

function normalizePeerCapabilityDescriptor(value: unknown): PeerCapabilityDescriptor | null {
  const record = asRecord(value);
  if (record == null) {
    return null;
  }

  const name = asString(record.name).trim();
  if (name === "") {
    return null;
  }

  return {
    meta: asRecord(record.meta) ?? undefined,
    name,
    reason: asString(record.reason).trim() || undefined,
    state: asString(record.state).trim() || undefined,
  };
}

function parsePeerCapabilityTruthFromDescriptors(capabilities: PeerCapabilityDescriptor[]): PeerCapabilityTruth | null {
  const nativeRemoteV2WebRTC = capabilities.find((capability) => {
    const name = capability.name.trim().toLowerCase();
    return (
      name === "android.native_remote_v2_webrtc" ||
      name === "native_remote_v2_webrtc" ||
      name === "nativeremotev2webrtc"
    );
  });

  if (nativeRemoteV2WebRTC?.state == null) {
    return null;
  }

  return {
    remoteControl: {
      capabilities: {
        nativeRemoteV2WebRTC: {
          reason: nativeRemoteV2WebRTC.reason,
          state: nativeRemoteV2WebRTC.state,
        },
      },
    },
  } satisfies PeerCapabilityTruth;
}

export function parsePeerCapabilityDescriptors(value: unknown): PeerCapabilityDescriptor[] {
  if (Array.isArray(value)) {
    const capabilities = [] as PeerCapabilityDescriptor[];

    for (const entry of value) {
      const capability = normalizePeerCapabilityDescriptor(entry);
      if (capability == null) {
        continue;
      }

      if (capability.name === "peer_capability_truth") {
        capabilities.push(...listPeerCapabilities(parsePeerCapabilityTruthDocument(capability.meta?.truth)));
        continue;
      }

      capabilities.push(capability);
    }

    return capabilities;
  }

  const record = asRecord(value);
  if (record == null) {
    return [];
  }

  if (Array.isArray(record.capabilities)) {
    return parsePeerCapabilityDescriptors(record.capabilities);
  }

  if (
    record.remoteControl != null ||
    record.connectionPath != null ||
    record.remote_control != null ||
    record.connection_path != null
  ) {
    return listPeerCapabilities(parsePeerCapabilityTruthDocument(record));
  }

  return [];
}

export function parsePeerCapabilityTruthDocument(value: unknown): PeerCapabilityTruth | null {
  const record = asRecord(value);
  if (record == null) {
    return null;
  }

  if (
    record.remoteControl != null ||
    record.connectionPath != null ||
    record.remote_control != null ||
    record.connection_path != null
  ) {
    const directTruth = {
      connectionPath: parseConnectionPathObservation(record.connectionPath ?? record.connection_path),
      remoteControl: parseRemoteControlState(record.remoteControl ?? record.remote_control),
    } satisfies PeerCapabilityTruth;
    return directTruth.connectionPath == null && directTruth.remoteControl == null ? null : directTruth;
  }

  return parsePeerCapabilityTruthFromDescriptors(parsePeerCapabilityDescriptors(record));
}

export function parseRemoteControlState(value: unknown): RemoteControlState | undefined {
  const record = asRecord(value);
  if (record == null) {
    return undefined;
  }
  const platform = asString(record.platform).trim().toLowerCase();
  if (platform !== "" && platform !== "android") {
    return undefined;
  }
  const capabilitiesRecord = asRecord(record.capabilities) ?? {};

  const nativeRemoteV2WebRTC = parseRemoteControlCapabilityState(
    capabilitiesRecord.native_remote_v2_webrtc ?? capabilitiesRecord.nativeRemoteV2WebRTC,
  );
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
