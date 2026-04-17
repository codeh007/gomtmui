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
import { logP2PConsole, summarizePeerCandidates } from "@/lib/p2p/p2p-console.ts";
import { requestPeerCapabilityTruth, WorkerControlRequestError } from "@/lib/p2p/worker-control.ts";
import {
  loadOrCreateBrowserPrivateKey,
  persistStoredBootstrapTarget,
  readStoredBootstrapTarget,
  resolveBootstrapTarget,
  shouldAllowPrivateBootstrapMultiaddr,
} from "./p2p-bootstrap-storage";
import { useLiveBrowserBootstrapTruth } from "./use-live-browser-bootstrap-truth";

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

export type P2PStatus = "loading" | "needs-bootstrap" | "joining" | "discovering" | "peer_candidates_ready" | "error";

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
  if (status === "joining") {
    return {
      dotClass: "bg-amber-500",
      label: "正在入网",
      tone: "secondary" as const,
    };
  }
  if (status === "needs-bootstrap") {
    return {
      dotClass: "bg-amber-500",
      label: "等待 bootstrap 地址",
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

export function formatBootstrapPathLabel(path: "direct" | "relay" | null | undefined) {
  if (path === "direct") {
    return "入网路径=直连";
  }
  if (path === "relay") {
    return "入网路径=中继";
  }
  return "入网路径=未知";
}

export function getBootstrapPathLabel(address: string | null | undefined) {
  return formatBootstrapPathLabel((address?.trim() ?? "") === "" ? null : "relay");
}

export function getPreferredPeerBootstrapPathLabel(multiaddrs: string[], bootstrapPath?: "direct" | "relay" | null) {
  const path = bootstrapPath ?? getPreferredBrowserConnectionPath(multiaddrs);
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
  readStoredBootstrapTarget: typeof readStoredBootstrapTarget;
  persistStoredBootstrapTarget: typeof persistStoredBootstrapTarget;
};

const defaultP2PSessionDeps: P2PSessionDeps = {
  assertBrowserP2PSupport,
  createBrowserNode,
  readStoredBootstrapTarget,
  persistStoredBootstrapTarget,
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

  if (error instanceof WorkerControlRequestError) {
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
  requestCapabilityTruth: typeof requestPeerCapabilityTruth;
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
  requestCapabilityTruth?: typeof requestPeerCapabilityTruth;
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

  const requestCapabilityTruth = params.requestCapabilityTruth ?? requestPeerCapabilityTruth;
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

export function describeBootstrapJoinError(input: { bootstrapAddr: string; error: unknown }) {
  const message = input.error instanceof Error ? input.error.message.trim() : String(input.error).trim();
  if (
    message.includes("unreachable bootstrap") ||
    message.includes("stream reset") ||
    message.includes("connection failed")
  ) {
    return `无法连接到 bootstrap 节点 ${input.bootstrapAddr}，请确认地址可用且当前网络支持该地址所需的传输。`;
  }
  return message === "" ? `无法连接到 bootstrap 节点 ${input.bootstrapAddr}。` : message;
}

function resolveBootstrapConnectTarget(input: string):
  | { kind: "ok"; target: ReturnType<typeof resolveBootstrapTarget> }
  | { kind: "error"; status: P2PStatus; message: string } {
  const rawInput = input.trim();
  if (rawInput === "") {
    return {
      kind: "error",
      status: "needs-bootstrap",
      message: "请输入 gomtm server 公网地址，或输入浏览器可拨的 bootstrap multiaddr。",
    };
  }

  try {
    return {
      kind: "ok",
      target: resolveBootstrapTarget(rawInput),
    };
  } catch (error) {
    return {
      kind: "error",
      status: "needs-bootstrap",
      message: error instanceof Error ? error.message : String(error),
    };
  }
}

function assertBrowserP2PSupport(transport: ReturnType<typeof resolveBootstrapTarget>["transport"]) {
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

type BootstrapConnectSuccessStateHandlers = {
  persistStoredBootstrapTarget: typeof persistStoredBootstrapTarget;
  setActiveBootstrapAddr: (value: string) => void;
  setBootstrapInput: (value: string) => void;
  setStatus: (value: P2PStatus) => void;
};

type BootstrapConnectFailureStateHandlers = {
  setActiveBootstrapAddr: (value: string) => void;
  setErrorMessage: (value: string | null) => void;
  setPeerCandidates: (value: PeerCandidate[]) => void;
  setStatus: (value: P2PStatus) => void;
  stopNode: (options?: { invalidateAttempt?: boolean }) => Promise<void>;
  updateResolvedPeerTruth: (nextValue: ResolvedPeerTruthMap) => void;
};

type BootstrapConnectResetStateHandlers = {
  setErrorMessage: (value: string | null) => void;
  setPeerCandidates: (value: PeerCandidate[]) => void;
  setStatus: (value: P2PStatus) => void;
  updateResolvedPeerTruth: (nextValue: ResolvedPeerTruthMap) => void;
};

function resetBootstrapConnectState(params: {
  handlers: BootstrapConnectResetStateHandlers;
  retryStateRef: React.MutableRefObject<Record<string, PeerTruthRetryState>>;
  target: ReturnType<typeof resolveBootstrapTarget>;
}) {
  params.retryStateRef.current = {};
  params.handlers.updateResolvedPeerTruth({});
  params.handlers.setStatus("joining");
  params.handlers.setErrorMessage(null);
  params.handlers.setPeerCandidates([]);
  logP2PConsole("info", "正在加入 P2P 网络", params.target, { verboseOnly: true });
}

async function commitBootstrapConnectFailure(params: {
  handlers: BootstrapConnectFailureStateHandlers;
  message: string;
}) {
  await params.handlers.stopNode({ invalidateAttempt: false });
  params.handlers.setActiveBootstrapAddr("");
  params.handlers.setPeerCandidates([]);
  params.handlers.updateResolvedPeerTruth({});
  params.handlers.setStatus("error");
  params.handlers.setErrorMessage(params.message);
}

async function commitBootstrapConnectSuccess(params: {
  bootstrapAddr: string;
  discovery: BrowserRendezvousDiscoveryService;
  handlers: BootstrapConnectSuccessStateHandlers;
  syncPeerCandidates: (node: BrowserNodeSession["node"]) => Promise<void>;
  node: BrowserNodeSession["node"];
}) {
  params.handlers.setActiveBootstrapAddr(params.bootstrapAddr);
  params.handlers.setStatus("discovering");
  await params.syncPeerCandidates(params.node);
  params.handlers.setStatus("peer_candidates_ready");
  params.handlers.setBootstrapInput(params.bootstrapAddr);
  params.handlers.persistStoredBootstrapTarget({ bootstrapAddr: params.bootstrapAddr });
  logP2PConsole(
    "info",
    "已接入 P2P 网络",
    {
      bootstrapAddr: params.bootstrapAddr,
      peerCandidates: (await params.discovery.listPeerCandidates()).length,
    },
    { verboseOnly: true },
  );
}

type BrowserTransportFactory = (components: any) => any;

async function createBrowserNode(target: { bootstrapAddr: string; transport: "webtransport" | "ws" }) {
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
  const rendezvousPoint = target.bootstrapAddr;
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
        if (shouldAllowPrivateBootstrapMultiaddr(candidateAddr, rendezvousPoint)) {
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
  const liveBootstrap = useLiveBrowserBootstrapTruth();
  const liveBootstrapAddr = useMemo(() => liveBootstrap.truthQuery.data?.candidates[0]?.addr?.trim() ?? "", [liveBootstrap]);
  const liveBootstrapStatus = liveBootstrap.truthQuery.status;
  const sessionRef = useRef<BrowserNodeSession | null>(null);
  const connectAttemptRef = useRef(0);
  const resolvedPeerTruthRef = useRef<ResolvedPeerTruthMap>({});
  const peerTruthRetryStateRef = useRef<Record<string, PeerTruthRetryState>>({});
  const [status, setStatus] = useState<P2PStatus>("loading");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [bootstrapInput, setBootstrapInput] = useState("");
  const [activeBootstrapAddr, setActiveBootstrapAddr] = useState("");
  const [peerCandidates, setPeerCandidates] = useState<PeerCandidate[]>([]);
  const [resolvedPeerTruth, setResolvedPeerTruth] = useState<ResolvedPeerTruthMap>({});

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
      let target: ReturnType<typeof resolveBootstrapTarget> | null = null;
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

      const bootstrapTarget = resolveBootstrapConnectTarget(options.input);
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
      resetBootstrapConnectState({
        handlers: {
          setErrorMessage,
          setPeerCandidates,
          setStatus,
          updateResolvedPeerTruth,
        },
        retryStateRef: peerTruthRetryStateRef,
        target,
      });

      try {
        const node = await p2pSessionDeps.createBrowserNode(target);
        createdNode = node;
        if (!isCurrentAttempt()) {
          await stopCreatedNode();
          return;
        }
        if (node.status !== "started") {
          await node.start();
          if (!isCurrentAttempt()) {
            await stopCreatedNode();
            return;
          }
        }
        const discovery = getRendezvousDiscoveryService(node);
        if (discovery == null) {
          throw new Error("browser rendezvous discovery service is missing");
        }
        await discovery.awaitReady();
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
        if (!isCurrentAttempt()) {
          await stopCreatedNode();
          return;
        }
        await commitBootstrapConnectSuccess({
          bootstrapAddr: target.bootstrapAddr,
          discovery,
          handlers: {
            persistStoredBootstrapTarget: p2pSessionDeps.persistStoredBootstrapTarget,
            setActiveBootstrapAddr,
            setBootstrapInput,
            setStatus,
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
        const message = describeBootstrapJoinError({ bootstrapAddr: target.bootstrapAddr, error });
        logP2PConsole("error", "接入 P2P 网络失败", message);
        await commitBootstrapConnectFailure({
          handlers: {
            setActiveBootstrapAddr,
            setErrorMessage,
            setPeerCandidates,
            setStatus,
            stopNode,
            updateResolvedPeerTruth,
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
      const storedTarget = p2pSessionDeps.readStoredBootstrapTarget();
      const storedBootstrapAddr = storedTarget.bootstrapAddr?.trim() ?? "";
      const initialInput = (storedBootstrapAddr || liveBootstrapAddr).trim();
      if (cancelled) {
        return;
      }

      setBootstrapInput(initialInput);

      if (initialInput !== "") {
        if (cancelled) {
          return;
        }

        await connectToBootstrap({ input: initialInput });
        return;
      }

      if (liveBootstrapStatus === "pending") {
        return;
      }

      setStatus("needs-bootstrap");
    }

    void init();

    return () => {
      cancelled = true;
      void stopNode();
    };
  }, [connectToBootstrap, liveBootstrapAddr, liveBootstrapStatus, stopNode]);

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
    activeBootstrapAddr,
    bootstrapInput,
    canConnect: status !== "loading" && status !== "joining" && status !== "discovering",
    connect: async () => {
      await connectToBootstrap({ input: bootstrapInput.trim() });
    },
    errorMessage,
    getCurrentNode: () => sessionRef.current?.node ?? null,
    getResolvedPeerTruth: (peerId: string) => getResolvedPeerTruth(resolvedPeerTruthRef.current, peerId),
    isConnected,
    peerCandidates,
    rememberPeerTruth,
    resolveDialableAddress,
    resolvedPeerTruth,
    setBootstrapInput,
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
