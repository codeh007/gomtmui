"use client";

import {
  createContext,
  createElement,
  type ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import type { PeerCandidate, PeerCapabilityTruth } from "@/lib/p2p/discovery-contracts.ts";
import {
  type BrowserNodeLike,
  getPreferredBrowserConnectionPath,
  pickDialableBrowserAddress,
} from "@/lib/p2p/libp2p-stream.ts";
import {
  type BrowserRendezvousDiscoveryService,
  GOMTM_RENDEZVOUS_NAMESPACE,
  gomtmRendezvousDiscovery,
} from "@/lib/p2p/rendezvous-discovery.ts";
import { requestAndroidPeerCapabilityTruth } from "@/lib/p2p/android-peer-api";
import { PeerHTTPRequestError } from "@/lib/p2p/peer-http-client";
import { logP2PConsole, summarizePeerCandidates } from "@/lib/p2p/p2p-console.ts";
import {
  clearStoredConnectionRuntime,
  loadOrCreateBrowserPrivateKey,
  persistStoredServerUrl,
  readStoredServerUrl,
  resolveConnectionEntryTargetAddress,
  shouldAllowPrivateConnectionEntryMultiaddr,
} from "./p2p-connection-runtime";
import { useLiveBrowserConnectionTruth } from "./use-live-browser-connection-truth";

const TRANSIENT_PEER_TRUTH_RETRY_DELAY_MS = 250;
const UNRESOLVED_PEER_TRUTH_RETRY_DELAY_MS = 1_000;
const MAX_UNRESOLVED_PEER_TRUTH_FAILURES = 3;

type PeerTruthRetryState = {
  failures: number;
  terminal: boolean;
};

type BrowserNodeSession = {
  node: Awaited<ReturnType<typeof createBrowserNode>>;
  disposeDiscoveryListener?: () => void;
};

export type P2PStatus =
  | "loading"
  | "needs-server-url"
  | "fetching-connection-truth"
  | "joining"
  | "discovering"
  | "peer_candidates_ready"
  | "error";

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

export type ResolvedPeerTruthMap = Record<string, PeerCapabilityTruth>;

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

type P2PSessionValue = ReturnType<typeof useP2PSessionState>;

type P2PSessionDeps = {
  assertBrowserP2PSupport: typeof assertBrowserP2PSupport;
  createBrowserNode: typeof createBrowserNode;
  logP2PConsole: typeof logP2PConsole;
};

const defaultP2PSessionDeps: P2PSessionDeps = {
  assertBrowserP2PSupport,
  createBrowserNode,
  logP2PConsole,
};

let p2pSessionDeps: P2PSessionDeps = defaultP2PSessionDeps;

export function __setP2PSessionDepsForTest(overrides: Partial<P2PSessionDeps>) {
  p2pSessionDeps = {
    ...defaultP2PSessionDeps,
    ...overrides,
  };
}

export function __resetP2PSessionDepsForTest() {
  p2pSessionDeps = defaultP2PSessionDeps;
}

export async function stopBrowserNodeIfConnectAttemptStale(params: {
  attemptId: number;
  getCurrentAttemptId: () => number;
  node: { stop: () => void | Promise<void> } | null;
}) {
  if (params.getCurrentAttemptId() === params.attemptId) {
    return false;
  }
  if (params.node == null) {
    return true;
  }
  try {
    await Promise.resolve(params.node.stop());
  } catch {}
  return true;
}

const P2PSessionContext = createContext<P2PSessionValue | null>(null);

export function getResolvedPeerTruth(cache: ResolvedPeerTruthMap, peerId: string) {
  const normalizedPeerId = peerId.trim();
  if (normalizedPeerId === "") {
    return null;
  }
  return cache[normalizedPeerId] ?? null;
}

export function rememberResolvedPeerTruth(cache: ResolvedPeerTruthMap, peerId: string, truth: PeerCapabilityTruth) {
  const normalizedPeerId = peerId.trim();
  if (normalizedPeerId === "") {
    return cache;
  }
  return {
    ...cache,
    [normalizedPeerId]: truth,
  } satisfies ResolvedPeerTruthMap;
}

function isTransientPeerTruthError(error: unknown) {
  const isTransientMessage = (message: string) =>
    message.includes("failed to connect via relay with status connection_failed") ||
    message.includes("remote closed connection during opening") ||
    message.includes("exactreadable ended") ||
    message.includes('the connection is "closing" and not "open"') ||
    message.includes('the connection is "closed" and not "open"') ||
    message.includes("cannot write to a stream that is closing") ||
    message.includes("the stream has been reset") ||
    message.includes("stream has been reset") ||
    message.includes("unexpected end of stream while reading json frame");

  if (error instanceof PeerHTTPRequestError) {
    if (error.retryable === true) {
      return true;
    }
    const normalizedMessage = error.message.trim().toLowerCase();
    return isTransientMessage(normalizedMessage);
  }

  const normalizedMessage =
    error instanceof Error ? error.message.trim().toLowerCase() : String(error).trim().toLowerCase();
  return isTransientMessage(normalizedMessage);
}

async function requestPeerCapabilityTruthWithRetry(params: {
  address: string;
  node: BrowserNodeLike;
  peerId: string;
  requestCapabilityTruth: typeof requestAndroidPeerCapabilityTruth;
}) {
  let lastError: unknown = null;
  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      return await params.requestCapabilityTruth({
        address: params.address,
        node: params.node,
        peerId: params.peerId,
      });
    } catch (error) {
      lastError = error;
      if (attempt > 0 || !isTransientPeerTruthError(error)) {
        throw error;
      }
      await new Promise((resolve) => globalThis.setTimeout(resolve, TRANSIENT_PEER_TRUTH_RETRY_DELAY_MS));
    }
  }

  throw lastError ?? new Error("requestPeerCapabilityTruth retry exhausted");
}

function buildPeerTruthRetryKey(peerId: string, address: string) {
  // terminal/retry budget is scoped to the current dialable address.
  // If discovery later resolves the same peer to a new address, treat that as a fresh probe context.
  return `${peerId.trim()}\n${address.trim()}`;
}

export async function resolveMissingPeerTruth(params: {
  candidates: PeerCandidate[];
  node: BrowserNodeLike | null;
  requestCapabilityTruth?: typeof requestAndroidPeerCapabilityTruth;
  resolveDialableAddress: (multiaddrs: string[]) => Promise<string | null | undefined>;
  resolvedPeerTruth: ResolvedPeerTruthMap;
  shouldSkipRetryKey?: (retryKey: string) => boolean;
}) {
  if (params.node == null || params.candidates.length === 0) {
    return {
      resolvedPeerTruth: params.resolvedPeerTruth,
      resolvedPeerKeys: [] as string[],
      retryablePeerKeys: [] as string[],
      terminalPeerKeys: [] as string[],
    };
  }

  const requestCapabilityTruth = params.requestCapabilityTruth ?? requestAndroidPeerCapabilityTruth;
  let nextCache = params.resolvedPeerTruth;
  const resolvedPeerKeys = [] as string[];
  const retryablePeerKeys = [] as string[];
  const terminalPeerKeys = [] as string[];
  for (const candidate of params.candidates) {
    if (getResolvedPeerTruth(nextCache, candidate.peerId) != null) {
      continue;
    }
    const address = await params.resolveDialableAddress(candidate.multiaddrs);
    if (address == null) {
      continue;
    }
    const retryKey = buildPeerTruthRetryKey(candidate.peerId, address);
    if (params.shouldSkipRetryKey?.(retryKey) === true) {
      continue;
    }
    try {
      const truth = await requestPeerCapabilityTruthWithRetry({
        address,
        node: params.node,
        peerId: candidate.peerId,
        requestCapabilityTruth,
      });
      nextCache = rememberResolvedPeerTruth(nextCache, candidate.peerId, truth);
      resolvedPeerKeys.push(retryKey);
    } catch (error) {
      if (isTransientPeerTruthError(error)) {
        retryablePeerKeys.push(retryKey);
        continue;
      }
      terminalPeerKeys.push(retryKey);
    }
  }
  return {
    resolvedPeerTruth: nextCache,
    resolvedPeerKeys,
    retryablePeerKeys,
    terminalPeerKeys,
  };
}

export function describeConnectionEntryError(input: { connectionAddr: string; error: unknown }) {
  const message = input.error instanceof Error ? input.error.message.trim() : String(input.error).trim();
  if (
    message.includes("unreachable seed") ||
    message.includes("unreachable connection") ||
    message.includes("stream reset") ||
    message.includes("connection failed")
  ) {
    return `无法连接到 连接入口 ${input.connectionAddr}，请确认地址可用且当前网络支持该地址所需的传输。`;
  }
  return message === "" ? `无法连接到 连接入口 ${input.connectionAddr}。` : message;
}

function resolveConnectionEntryTarget(input: string):
  | { kind: "ok"; target: ReturnType<typeof resolveConnectionEntryTargetAddress> }
  | { kind: "error"; status: P2PStatus; message: string } {
  const rawInput = input.trim();
  if (rawInput === "") {
    return {
      kind: "error",
      status: "error",
      message: "请输入 gomtm server 公网地址。",
    };
  }

  try {
    return {
      kind: "ok",
      target: resolveConnectionEntryTargetAddress(rawInput),
    };
  } catch (error) {
    return {
      kind: "error",
      status: "error",
      message: error instanceof Error ? error.message : String(error),
    };
  }
}

function assertBrowserP2PSupport(transport: ReturnType<typeof resolveConnectionEntryTargetAddress>["transport"]) {
  if (transport !== "webtransport") {
    return;
  }
  if (!window.isSecureContext) {
    throw new Error("当前页面不是安全上下文，浏览器无法建立 WebTransport 连接。");
  }
  if (!("WebTransport" in window)) {
    throw new Error("当前浏览器不支持 WebTransport。");
  }
}

type ConnectionSuccessStateHandlers = {
  setActiveConnectionAddr: (value: string) => void;
  setStatus: (value: P2PStatus) => void;
  setDebugConnectPhase: (value: string) => void;
  setDebugLastError: (value: string | null) => void;
};

type ConnectionFailureStateHandlers = {
  setActiveConnectionAddr: (value: string) => void;
  setErrorMessage: (value: string | null) => void;
  setPeerCandidates: (value: PeerCandidate[]) => void;
  setStatus: (value: P2PStatus) => void;
  stopNode: (options?: { invalidateAttempt?: boolean }) => Promise<void>;
  updateResolvedPeerTruth: (nextValue: ResolvedPeerTruthMap) => void;
  setDebugConnectPhase: (value: string) => void;
  setDebugLastError: (value: string | null) => void;
};

type ConnectionResetStateHandlers = {
  logP2PConsole: typeof logP2PConsole;
  setErrorMessage: (value: string | null) => void;
  setPeerCandidates: (value: PeerCandidate[]) => void;
  setStatus: (value: P2PStatus) => void;
  updateResolvedPeerTruth: (nextValue: ResolvedPeerTruthMap) => void;
};

function resetConnectionState(params: {
  handlers: ConnectionResetStateHandlers;
  retryStateRef: React.MutableRefObject<Record<string, PeerTruthRetryState>>;
  target: ReturnType<typeof resolveConnectionEntryTargetAddress>;
}) {
  params.retryStateRef.current = {};
  params.handlers.updateResolvedPeerTruth({});
  params.handlers.setStatus("joining");
  params.handlers.setErrorMessage(null);
  params.handlers.setPeerCandidates([]);
  params.handlers.logP2PConsole("info", "正在加入 P2P 网络", params.target, { verboseOnly: true });
}

async function commitConnectionFailure(params: {
  handlers: ConnectionFailureStateHandlers;
  message: string;
}) {
  await params.handlers.stopNode({ invalidateAttempt: false });
  params.handlers.setActiveConnectionAddr("");
  params.handlers.setPeerCandidates([]);
  params.handlers.updateResolvedPeerTruth({});
  params.handlers.setDebugConnectPhase("failed");
  params.handlers.setDebugLastError(params.message);
  params.handlers.setStatus("error");
  params.handlers.setErrorMessage(params.message);
}

async function commitConnectionSuccess(params: {
  connectionAddr: string;
  discovery: BrowserRendezvousDiscoveryService;
  handlers: ConnectionSuccessStateHandlers;
  syncPeerCandidates: (node: BrowserNodeSession["node"]) => Promise<void>;
  node: BrowserNodeSession["node"];
}) {
  params.handlers.setDebugLastError(null);
  params.handlers.setDebugConnectPhase("commit-success");
  params.handlers.setActiveConnectionAddr(params.connectionAddr);
  params.handlers.setStatus("discovering");
  await params.syncPeerCandidates(params.node);
  params.handlers.setStatus("peer_candidates_ready");
  logP2PConsole(
    "info",
    "已接入 P2P 网络",
    {
      connectionAddr: params.connectionAddr,
      peerCandidates: (await params.discovery.listPeerCandidates()).length,
    },
    { verboseOnly: true },
  );
}

type BrowserTransportFactory = (components: any) => any;

async function createBrowserNode(target: { connectionAddr: string; transport: "webtransport" | "ws" }) {
  const [
    { createLibp2p },
    webTransportModule,
    webSocketsModule,
    { circuitRelayTransport },
    { noise },
    { yamux },
    { identify },
    { isPrivate },
  ] = await Promise.all([
    import("libp2p"),
    import("@libp2p/webtransport"),
    import("@libp2p/websockets"),
    import("@libp2p/circuit-relay-v2"),
    import("@chainsafe/libp2p-noise"),
    import("@chainsafe/libp2p-yamux"),
    import("@libp2p/identify"),
    import("@libp2p/utils"),
  ]);

  const privateKey = await loadOrCreateBrowserPrivateKey();
  const rendezvousPoint = target.connectionAddr;
  const transportFactories: BrowserTransportFactory[] = [circuitRelayTransport() as BrowserTransportFactory];
  if (target.transport === "webtransport") {
    transportFactories.unshift(webTransportModule.webTransport() as BrowserTransportFactory);
  } else {
    transportFactories.unshift(webSocketsModule.webSockets() as BrowserTransportFactory);
  }

  return createLibp2p({
    privateKey,
    connectionGater: {
      denyDialMultiaddr: (candidate) => {
        const candidateAddr = candidate.toString();
        if (shouldAllowPrivateConnectionEntryMultiaddr(candidateAddr, rendezvousPoint)) {
          return false;
        }
        return isPrivate(candidate);
      },
    },
    transports: transportFactories,
    connectionEncrypters: [noise()],
    streamMuxers: [yamux()],
    services: {
      identify: identify(),
      rendezvousDiscovery: gomtmRendezvousDiscovery({
        namespace: GOMTM_RENDEZVOUS_NAMESPACE,
        points: [rendezvousPoint],
      }),
    },
  });
}

function getRendezvousDiscoveryService(node: BrowserNodeSession["node"]) {
  return (node.services as { rendezvousDiscovery?: BrowserRendezvousDiscoveryService }).rendezvousDiscovery ?? null;
}

function useP2PSessionState() {
  const [serverUrl, setServerUrl] = useState("");
  const [serverUrlInput, setServerUrlInput] = useState("");
  const liveConnection = useLiveBrowserConnectionTruth(serverUrl);
  const liveConnectionAddr = useMemo(() => liveConnection.truthQuery.data?.candidates[0]?.addr?.trim() ?? "", [liveConnection]);
  const liveConnectionStatus = liveConnection.truthQuery.status;
  const liveConnectionGeneration = liveConnection.truthQuery.data?.generation ?? "";
  const sessionRef = useRef<BrowserNodeSession | null>(null);
  const connectAttemptRef = useRef(0);
  const resolvedPeerTruthRef = useRef<ResolvedPeerTruthMap>({});
  const peerTruthRetryStateRef = useRef<Record<string, PeerTruthRetryState>>({});
  const [status, setStatus] = useState<P2PStatus>("loading");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [activeConnectionAddr, setActiveConnectionAddr] = useState("");
  const [peerCandidates, setPeerCandidates] = useState<PeerCandidate[]>([]);
  const [resolvedPeerTruth, setResolvedPeerTruth] = useState<ResolvedPeerTruthMap>({});
  const [debugConnectPhase, setDebugConnectPhase] = useState("idle");
  const [debugLastError, setDebugLastError] = useState<string | null>(null);

  const updateResolvedPeerTruth = useCallback((nextValue: ResolvedPeerTruthMap) => {
    resolvedPeerTruthRef.current = nextValue;
    setResolvedPeerTruth(nextValue);
  }, []);

  const rememberPeerTruth = useCallback(
    (peerId: string, truth: PeerCapabilityTruth) => {
      const nextValue = rememberResolvedPeerTruth(resolvedPeerTruthRef.current, peerId, truth);
      updateResolvedPeerTruth(nextValue);
      return truth;
    },
    [updateResolvedPeerTruth],
  );

  const stopNode = useCallback(async (options?: { invalidateAttempt?: boolean }) => {
    if (options?.invalidateAttempt !== false) {
      connectAttemptRef.current += 1;
    }
    const current = sessionRef.current;
    sessionRef.current = null;
    if (current != null) {
      current.disposeDiscoveryListener?.();
      await current.node.stop();
    }
  }, []);

  const syncPeerCandidates = useCallback(async (node: BrowserNodeSession["node"]) => {
    const discovery = getRendezvousDiscoveryService(node);
    if (discovery == null) {
      return;
    }
    const candidates = await discovery.listPeerCandidates();
    if (sessionRef.current?.node !== node) {
      return;
    }
    logP2PConsole("debug", "节点候选已更新", summarizePeerCandidates(candidates), { verboseOnly: true });
    setPeerCandidates(candidates);
  }, []);

  const connectToBootstrap = useCallback(
    async (options: { input: string }) => {
      let target: ReturnType<typeof resolveConnectionEntryTargetAddress> | null = null;
      const attemptId = connectAttemptRef.current + 1;
      connectAttemptRef.current = attemptId;
      let createdNode: BrowserNodeSession["node"] | null = null;

      const isCurrentAttempt = () => connectAttemptRef.current === attemptId;
      const stopCreatedNode = async () => {
        await stopBrowserNodeIfConnectAttemptStale({
          attemptId,
          getCurrentAttemptId: () => connectAttemptRef.current,
          node: createdNode,
        });
      };

      const bootstrapTarget = resolveConnectionEntryTarget(options.input);
      if (bootstrapTarget.kind === "error") {
        setStatus(bootstrapTarget.status);
        setErrorMessage(bootstrapTarget.message);
        return false;
      }
      target = bootstrapTarget.target;

      try {
        p2pSessionDeps.assertBrowserP2PSupport(target.transport);
      } catch (error) {
        if (!isCurrentAttempt()) {
          return;
        }
        const message = error instanceof Error ? error.message : String(error);
        setStatus("error");
        setErrorMessage(message);
        return false;
      }

      await stopNode({ invalidateAttempt: false });
      if (!isCurrentAttempt()) {
        return;
      }
      resetConnectionState({
        handlers: {
          logP2PConsole: p2pSessionDeps.logP2PConsole,
          setErrorMessage,
          setPeerCandidates,
          setStatus,
          updateResolvedPeerTruth,
        },
        retryStateRef: peerTruthRetryStateRef,
        target,
      });
      setDebugLastError(null);
      setDebugConnectPhase("resolving-node");

      try {
        const node = await p2pSessionDeps.createBrowserNode(target);
        setDebugConnectPhase("node-created");
        createdNode = node;
        p2pSessionDeps.logP2PConsole("info", "browser node created", {
          connectionAddr: target.connectionAddr,
          transport: target.transport,
        });
        if (!isCurrentAttempt()) {
          await stopCreatedNode();
          return;
        }
        if (node.status !== "started") {
          setDebugConnectPhase("starting-node");
          await node.start();
          setDebugConnectPhase("node-started");
          p2pSessionDeps.logP2PConsole("info", "browser node started", {
            connectionAddr: target.connectionAddr,
            transport: target.transport,
          });
          if (!isCurrentAttempt()) {
            await stopCreatedNode();
            return;
          }
        }
        const discovery = getRendezvousDiscoveryService(node);
        setDebugConnectPhase("discovery-service-ready");
        if (discovery == null) {
          throw new Error("browser rendezvous discovery service is missing");
        }
        p2pSessionDeps.logP2PConsole("info", "awaiting rendezvous ready", {
          connectionAddr: target.connectionAddr,
        });
        setDebugConnectPhase("awaiting-rendezvous-ready");
        await discovery.awaitReady();
        setDebugConnectPhase("rendezvous-ready");
        p2pSessionDeps.logP2PConsole("info", "rendezvous ready", {
          connectionAddr: target.connectionAddr,
        });
        if (!isCurrentAttempt()) {
          await stopCreatedNode();
          return;
        }

        const handlePeerEvent = () => {
          if (sessionRef.current?.node !== node) {
            return;
          }
          void syncPeerCandidates(node);
        };
        node.addEventListener("peer:discovery", handlePeerEvent as EventListener);
        node.addEventListener("peer:update", handlePeerEvent as EventListener);
        node.addEventListener("peer:identify", handlePeerEvent as EventListener);
        node.addEventListener("peer:connect", handlePeerEvent as EventListener);
        node.addEventListener("peer:disconnect", handlePeerEvent as EventListener);
        sessionRef.current = {
          node,
          disposeDiscoveryListener: () => {
            node.removeEventListener("peer:discovery", handlePeerEvent as EventListener);
            node.removeEventListener("peer:update", handlePeerEvent as EventListener);
            node.removeEventListener("peer:identify", handlePeerEvent as EventListener);
            node.removeEventListener("peer:connect", handlePeerEvent as EventListener);
            node.removeEventListener("peer:disconnect", handlePeerEvent as EventListener);
          },
        };
        setDebugConnectPhase("session-bound");
        if (!isCurrentAttempt()) {
          await stopCreatedNode();
          return;
        }
        await commitConnectionSuccess({
          connectionAddr: target.connectionAddr,
          discovery,
          handlers: {
            setActiveConnectionAddr,
            setStatus,
            setDebugConnectPhase,
            setDebugLastError,
          },
          syncPeerCandidates,
          node,
        });
        if (!isCurrentAttempt()) {
          await stopCreatedNode();
          return;
        }
        return true;
      } catch (error) {
        if (!isCurrentAttempt()) {
          await stopCreatedNode();
          return;
        }
        const message = describeConnectionEntryError({ connectionAddr: target.connectionAddr, error });
        logP2PConsole("error", "接入 P2P 网络失败", message);
        await commitConnectionFailure({
          handlers: {
            setActiveConnectionAddr,
            setErrorMessage,
            setPeerCandidates,
            setStatus,
            stopNode,
            updateResolvedPeerTruth,
            setDebugConnectPhase,
            setDebugLastError,
          },
          message,
        });
        return false;
      }
    },
    [stopNode, syncPeerCandidates, updateResolvedPeerTruth],
  );

  useEffect(() => {
    let cancelled = false;

    async function init() {
      const storedServerUrl = readStoredServerUrl().trim();
      const storedConnectionAddr = "";
      const hasExistingSession = sessionRef.current?.node != null || activeConnectionAddr.trim() !== "";
      if (cancelled) {
        return;
      }

      setServerUrl(storedServerUrl);
      setServerUrlInput(storedServerUrl);

      if (storedServerUrl === "") {
        setStatus("needs-server-url");
        return;
      }

      if (liveConnectionStatus === "pending") {
        if (hasExistingSession) {
          setErrorMessage(null);
          return;
        }
        setStatus("fetching-connection-truth");
        return;
      }

      if (liveConnectionStatus === "error") {
        if (hasExistingSession) {
          setStatus((currentStatus) => (currentStatus === "discovering" || currentStatus === "joining" ? currentStatus : "peer_candidates_ready"));
          setErrorMessage(null);
          return;
        }
        setStatus("error");
        setErrorMessage(liveConnection.truthQuery.error instanceof Error ? liveConnection.truthQuery.error.message : "读取后端 连接信息失败");
        return;
      }

      const initialInput = liveConnectionAddr.trim();

      if (initialInput === "") {
        if (hasExistingSession) {
          setStatus((currentStatus) => (currentStatus === "discovering" || currentStatus === "joining" ? currentStatus : "peer_candidates_ready"));
          setErrorMessage(null);
          return;
        }
        setStatus("error");
        setErrorMessage("当前后端未返回可用于浏览器的连接信息，请检查 gomtm server 状态。");
        return;
      }

      const shouldAutoConnectLiveConnection =
        storedConnectionAddr === "" &&
        liveConnectionAddr !== "" &&
        activeConnectionAddr.trim() === "" &&
        status !== "joining" &&
        status !== "discovering" &&
        status !== "peer_candidates_ready";

      const shouldReconnectForConnectionChange =
        liveConnectionAddr !== "" &&
        activeConnectionAddr.trim() !== "" &&
        activeConnectionAddr.trim() !== liveConnectionAddr &&
        storedConnectionAddr === "";

      if (shouldAutoConnectLiveConnection || shouldReconnectForConnectionChange) {
        await connectToBootstrap({ input: initialInput });
      }
    }

    void init();

    return () => {
      cancelled = true;
    };
  }, [
    activeConnectionAddr,
    connectToBootstrap,
    liveConnectionAddr,
    liveConnectionGeneration,
    liveConnectionStatus,
    liveConnection.truthQuery.error,
    status,
  ]);

  useEffect(() => {
    return () => {
      void stopNode();
    };
  }, [stopNode]);

  const resolveDialableAddress = useCallback(async (multiaddrs: string[]) => {
    const node = sessionRef.current?.node;
    if (node == null) {
      return null;
    }
    return (
      (await pickDialableBrowserAddress({
        node: node as BrowserNodeLike,
        multiaddrs,
      })) ?? null
    );
  }, []);

  const isConnected = status === "discovering" || status === "peer_candidates_ready";

  useEffect(() => {
    let cancelled = false;
    let retryTimer: ReturnType<typeof globalThis.setTimeout> | null = null;
    const node = sessionRef.current?.node ?? null;
    if (!isConnected || node == null || peerCandidates.length === 0) {
      return;
    }

    const scheduleRetryIfNeeded = (params: {
      resolvedPeerKeys: string[];
      retryablePeerKeys: string[];
      terminalPeerKeys: string[];
    }) => {
      if (cancelled) {
        return;
      }
      const nextRetryState = {
        ...peerTruthRetryStateRef.current,
      } satisfies Record<string, PeerTruthRetryState>;

      for (const resolvedPeerKey of params.resolvedPeerKeys) {
        delete nextRetryState[resolvedPeerKey];
      }

      for (const terminalPeerKey of params.terminalPeerKeys) {
        nextRetryState[terminalPeerKey] = {
          failures: nextRetryState[terminalPeerKey]?.failures ?? 1,
          terminal: true,
        };
      }

      let shouldRetry = false;
      for (const retryKey of params.retryablePeerKeys) {
        if (nextRetryState[retryKey]?.terminal === true) {
          continue;
        }
        const nextFailureCount = (nextRetryState[retryKey]?.failures ?? 0) + 1;
        if (nextFailureCount >= MAX_UNRESOLVED_PEER_TRUTH_FAILURES) {
          nextRetryState[retryKey] = {
            failures: nextFailureCount,
            terminal: true,
          };
          continue;
        }
        nextRetryState[retryKey] = {
          failures: nextFailureCount,
          terminal: false,
        };
        shouldRetry = true;
      }

      peerTruthRetryStateRef.current = nextRetryState;
      if (!shouldRetry) {
        return;
      }
      retryTimer = globalThis.setTimeout(() => {
        retryTimer = null;
        void hydratePeerTruth();
      }, UNRESOLVED_PEER_TRUTH_RETRY_DELAY_MS);
    };

    async function hydratePeerTruth() {
      const nextResolution = await resolveMissingPeerTruth({
        candidates: peerCandidates,
        node,
        resolveDialableAddress,
        resolvedPeerTruth: resolvedPeerTruthRef.current,
        shouldSkipRetryKey: (retryKey) => peerTruthRetryStateRef.current[retryKey]?.terminal === true,
      });
      const { resolvedPeerTruth: nextValue } = nextResolution;
      if (cancelled || nextValue === resolvedPeerTruthRef.current) {
        scheduleRetryIfNeeded(nextResolution);
        return;
      }
      updateResolvedPeerTruth(nextValue);
      scheduleRetryIfNeeded(nextResolution);
    }

    void hydratePeerTruth();

    return () => {
      cancelled = true;
      if (retryTimer != null) {
        globalThis.clearTimeout(retryTimer);
      }
    };
  }, [isConnected, peerCandidates, resolveDialableAddress, updateResolvedPeerTruth]);

  return {
    activeConnectionAddr,
    canConnect: status !== "loading" && status !== "joining" && status !== "discovering" && serverUrl.trim() !== "",
    connect: async () => {
      if (liveConnectionAddr.trim() === "") {
        return false;
      }
      return connectToBootstrap({ input: liveConnectionAddr.trim() });
    },
    debugConnectPhase,
    debugLastError,
    errorMessage,
    getCurrentNode: () => sessionRef.current?.node ?? null,
    getResolvedPeerTruth: (peerId: string) => getResolvedPeerTruth(resolvedPeerTruthRef.current, peerId),
    isConnected,
    peerCandidates,
    rememberPeerTruth,
    resolveDialableAddress,
    resolvedPeerTruth,
    serverUrl,
    serverUrlInput,
    setServerUrlInput,
    saveServerUrl: async () => {
      const normalized = serverUrlInput.trim();
      persistStoredServerUrl(normalized);
      clearStoredConnectionRuntime();
      await stopNode();
      setActiveConnectionAddr("");
      setPeerCandidates([]);
      updateResolvedPeerTruth({});
      setErrorMessage(null);
      setServerUrl(normalized);
      setStatus(normalized === "" ? "needs-server-url" : "fetching-connection-truth");
    },
    status,
  };
}

export function P2PSessionProvider({ children }: { children: ReactNode }) {
  const value = useP2PSessionState();
  return createElement(P2PSessionContext.Provider, { value }, children);
}

export function useP2PSession() {
  const value = useContext(P2PSessionContext);
  if (value == null) {
    throw new Error("useP2PSession must be used within P2PSessionProvider");
  }
  return value;
}
