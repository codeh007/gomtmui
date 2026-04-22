import {
  listPeerCapabilities,
  parsePeerCapabilityDescriptors,
  type PeerCandidate,
  type PeerCapabilityDescriptor,
  type PeerCapabilityTruth,
} from "@/lib/p2p/discovery-contracts";
import { deriveBrowserRelayAddressFromConnectionEntry, getPreferredBrowserConnectionPath } from "@/lib/p2p/libp2p-stream";
import { normalizeBrowserConnectionAddr } from "../p2p-connection-runtime";

export type P2PHostKind = "browser" | "android-host";

export type RuntimeNodeSummary = {
  peerId: string;
  multiaddrs?: string[];
  discoveredAt?: string;
};

export type RuntimeCapability = PeerCapabilityDescriptor;

export type P2PStatus =
  | "loading"
  | "needs-server-url"
  | "fetching-connection-truth"
  | "joining"
  | "discovering"
  | "peer_candidates_ready"
  | "error";

export type ResolvedPeerTruthMap = Record<string, PeerCapabilityTruth>;

export type ReadPeerCapabilitiesOptions = {
  forceRefresh?: boolean;
};

export type P2PRuntimeState = {
  hostKind: P2PHostKind;
  currentNode: RuntimeNodeSummary | null;
  peers: RuntimeNodeSummary[];
  status: P2PStatus;
  diagnostics: Record<string, unknown>;
  getResolvedPeerCapabilities?: (peerId: string) => RuntimeCapability[] | null;
  readPeerCapabilities: (peerId: string, options?: ReadPeerCapabilitiesOptions) => Promise<RuntimeCapability[]>;
  resolvePeerCapabilityReadAddress?: (peerId: string) => Promise<string | null>;
  saveConnection: (connection: string) => Promise<void>;
  activeConnectionAddr: string;
  canConnect: boolean;
  connect: () => Promise<boolean>;
  debugConnectPhase: string;
  debugLastError: string | null;
  errorMessage: string | null;
  getResolvedPeerTruth: (peerId: string) => PeerCapabilityTruth | null;
  isConnected: boolean;
  peerCandidates: PeerCandidate[];
  saveServerUrl: () => Promise<void>;
  serverUrl: string;
  serverUrlInput: string;
  setServerUrlInput: (value: string) => void;
};

function asRecord(value: unknown) {
  return value !== null && typeof value === "object" ? (value as Record<string, unknown>) : null;
}

export function getP2PStatusMeta(status: P2PStatus) {
  if (status === "peer_candidates_ready") {
    return {
      dotClass: "bg-emerald-500 shadow-[0_0_0_4px_rgba(34,197,94,0.15)]",
      label: "节点发现已就绪",
      tone: "default" as const,
    };
  }
  if (status === "discovering") {
    return {
      dotClass: "bg-emerald-500 shadow-[0_0_0_4px_rgba(34,197,94,0.15)]",
      label: "正在发现节点",
      tone: "default" as const,
    };
  }
  if (status === "fetching-connection-truth") {
    return {
      dotClass: "bg-amber-500",
      label: "正在读取后端 连接信息",
      tone: "secondary" as const,
    };
  }
  if (status === "joining") {
    return {
      dotClass: "bg-amber-500",
      label: "正在入网",
      tone: "secondary" as const,
    };
  }
  if (status === "needs-server-url") {
    return {
      dotClass: "bg-amber-500",
      label: "等待后端地址",
      tone: "secondary" as const,
    };
  }
  if (status === "error") {
    return {
      dotClass: "bg-rose-500",
      label: "连接失败",
      tone: "destructive" as const,
    };
  }
  return {
    dotClass: "bg-amber-500",
    label: "正在准备",
    tone: "secondary" as const,
  };
}

export function formatConnectionPathLabel(path: "direct" | "relay" | null | undefined) {
  if (path === "direct") {
    return "入网路径=直连";
  }
  if (path === "relay") {
    return "入网路径=中继";
  }
  return "入网路径=未知";
}

export function getConnectionPathLabel(address: string | null | undefined) {
  return formatConnectionPathLabel((address?.trim() ?? "") === "" ? null : "relay");
}

export function pickObservedRelayBrowserAddress(multiaddrs: string[]) {
  const normalized = multiaddrs
    .map((value) => normalizeBrowserConnectionAddr(value.trim()))
    .filter((value) => value.startsWith("/"));
  return (
    normalized.find((value) => value.includes("/p2p-circuit/") && value.includes("/webtransport/")) ??
    normalized.find((value) => value.includes("/p2p-circuit/")) ??
    null
  );
}

export function resolveBrowserCapabilityProbeAddress(params: {
  activeConnectionAddr: string | null | undefined;
  dialableAddress: string | null | undefined;
  multiaddrs: string[];
  peerId: string;
}) {
  const dialableAddress = normalizeBrowserConnectionAddr(params.dialableAddress?.trim() ?? "");
  if (dialableAddress !== "") {
    return dialableAddress;
  }

  return (
    pickObservedRelayBrowserAddress(params.multiaddrs) ??
    deriveBrowserRelayAddressFromConnectionEntry({
      activeConnectionAddr: params.activeConnectionAddr,
      multiaddrs: params.multiaddrs,
      peerId: params.peerId,
    })
  );
}

export function getPreferredPeerConnectionPathLabel(multiaddrs: string[], connectionPath?: "direct" | "relay" | null) {
  const path = connectionPath ?? getPreferredBrowserConnectionPath(multiaddrs);
  if (path === "direct") {
    return "入网=直连";
  }
  if (path === "relay") {
    return "入网=中继";
  }
  return "入网=未知";
}

export function getRuntimeNodeSummary(input: unknown, fallbackMultiaddrs?: string[]): RuntimeNodeSummary | null {
  if (input == null || typeof input !== "object") {
    return null;
  }

  const peerIdCandidate = (input as { peerId?: unknown; id?: unknown }).peerId ?? (input as { id?: unknown }).id;
  const peerId =
    typeof peerIdCandidate === "string"
      ? peerIdCandidate.trim()
      : peerIdCandidate != null && typeof (peerIdCandidate as { toString: () => string }).toString === "function"
        ? (peerIdCandidate as { toString: () => string }).toString().trim()
        : "";

  if (peerId === "") {
    return null;
  }

  const candidateRecord = input as {
    lastDiscoveredAt?: unknown;
    multiaddrs?: unknown;
  };

  const multiaddrs = Array.isArray(candidateRecord.multiaddrs)
    ? candidateRecord.multiaddrs.filter((value): value is string => typeof value === "string" && value.trim() !== "")
    : (fallbackMultiaddrs ?? []).filter((value) => value.trim() !== "");

  return {
    peerId,
    multiaddrs: multiaddrs.length === 0 ? undefined : multiaddrs,
    discoveredAt:
      typeof candidateRecord.lastDiscoveredAt === "string" && candidateRecord.lastDiscoveredAt.trim() !== ""
        ? candidateRecord.lastDiscoveredAt.trim()
        : undefined,
  };
}

export function buildRuntimeCapabilitiesFromTruth(truth: PeerCapabilityTruth | null | undefined): RuntimeCapability[] {
  return listPeerCapabilities(truth);
}

export function normalizeRuntimeCapabilities(value: unknown): RuntimeCapability[] {
  const descriptors = parsePeerCapabilityDescriptors(value);
  if (descriptors.length > 0) {
    return descriptors;
  }

  const record = asRecord(value);
  if (record == null) {
    return [];
  }

  if (record.remoteControl != null || record.connectionPath != null) {
    return buildRuntimeCapabilitiesFromTruth(record as PeerCapabilityTruth);
  }

  return [];
}

export function getPeerCapabilityTruthFromRuntimeCapabilities(capabilities: RuntimeCapability[]): PeerCapabilityTruth | null {
  for (const capability of capabilities) {
    if (capability.name !== "peer_capability_truth") {
      continue;
    }

    const truth = asRecord(capability.meta?.truth);
    if (truth != null) {
      return truth as PeerCapabilityTruth;
    }
  }

  const nativeRemoteCapability = capabilities.find(
    (capability) =>
      capability.name === "android.native_remote_v2_webrtc" ||
      capability.name === "native_remote_v2_webrtc" ||
      capability.name === "nativeRemoteV2WebRTC",
  );
  if (nativeRemoteCapability?.state == null) {
    return null;
  }

  return {
    remoteControl: {
      capabilities: {
        nativeRemoteV2WebRTC: {
          reason: nativeRemoteCapability.reason,
          state: nativeRemoteCapability.state,
        },
      },
    },
  } satisfies PeerCapabilityTruth;
}
