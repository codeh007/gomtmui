"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import type { PeerCandidate } from "@/lib/p2p/discovery-contracts.ts";
import {
  type BrowserRendezvousDiscoveryService,
  GOMTM_RENDEZVOUS_NAMESPACE,
  gomtmRendezvousDiscovery,
} from "@/lib/p2p/rendezvous-discovery.ts";
import { logP2PConsole, summarizePeerCandidates } from "@/lib/p2p/p2p-console.ts";
import {
  clearStoredConnectionRuntime,
  loadOrCreateBrowserPrivateKey,
  persistStoredServerUrl,
  readStoredServerUrl,
  resolveConnectionEntryTargetAddress,
  shouldAllowPrivateConnectionEntryMultiaddr,
} from "../p2p-connection-runtime";
import { useLiveBrowserConnectionTruth } from "../use-live-browser-connection-truth";
import {
  getRuntimeNodeSummary,
  type P2PRuntimeState,
  type P2PStatus,
} from "./p2p-runtime-contract";

type BrowserNodeSession = {
  node: Awaited<ReturnType<typeof createBrowserNode>>;
  disposeDiscoveryListener?: () => void;
};

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
  setDebugConnectPhase: (value: string) => void;
  setDebugLastError: (value: string | null) => void;
};

type ConnectionResetStateHandlers = {
  logP2PConsole: typeof logP2PConsole;
  setErrorMessage: (value: string | null) => void;
  setPeerCandidates: (value: PeerCandidate[]) => void;
  setStatus: (value: P2PStatus) => void;
};

function resetConnectionState(params: {
  handlers: ConnectionResetStateHandlers;
  target: ReturnType<typeof resolveConnectionEntryTargetAddress>;
}) {
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

function useBrowserP2PRuntimeState(): P2PRuntimeState {
  const [serverUrl, setServerUrl] = useState("");
  const [serverUrlInput, setServerUrlInput] = useState("");
  const liveConnection = useLiveBrowserConnectionTruth(serverUrl);
  const liveConnectionAddr = useMemo(() => liveConnection.truthQuery.data?.candidates[0]?.addr?.trim() ?? "", [liveConnection]);
  const liveConnectionStatus = liveConnection.truthQuery.status;
  const liveConnectionGeneration = liveConnection.truthQuery.data?.generation ?? "";
  const sessionRef = useRef<BrowserNodeSession | null>(null);
  const connectAttemptRef = useRef(0);
  const [status, setStatus] = useState<P2PStatus>("loading");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [activeConnectionAddr, setActiveConnectionAddr] = useState("");
  const [peerCandidates, setPeerCandidates] = useState<PeerCandidate[]>([]);
  const [debugConnectPhase, setDebugConnectPhase] = useState("idle");
  const [debugLastError, setDebugLastError] = useState<string | null>(null);

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
        },
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
            setDebugConnectPhase,
            setDebugLastError,
          },
          message,
        });
        return false;
      }
    },
    [stopNode, syncPeerCandidates],
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

  const isConnected = status === "discovering" || status === "peer_candidates_ready";

  const currentNode = useMemo(
    () =>
      getRuntimeNodeSummary(
        sessionRef.current?.node ?? null,
        activeConnectionAddr.trim() === "" ? undefined : [activeConnectionAddr.trim()],
      ),
    [activeConnectionAddr, status],
  );

  const peers = useMemo(
    () =>
      peerCandidates.map(
        (peer) => getRuntimeNodeSummary(peer) ?? { peerId: peer.peerId, multiaddrs: peer.multiaddrs, discoveredAt: peer.lastDiscoveredAt },
      ),
    [peerCandidates],
  );

  const saveConnection = useCallback(
    async (connection: string) => {
      const normalized = connection.trim();
      persistStoredServerUrl(normalized);
      clearStoredConnectionRuntime();
      await stopNode();
      setActiveConnectionAddr("");
      setPeerCandidates([]);
      setErrorMessage(null);
      setServerUrlInput(normalized);
      setServerUrl(normalized);
      setStatus(normalized === "" ? "needs-server-url" : "fetching-connection-truth");
    },
    [stopNode],
  );

  return {
    hostKind: "browser",
    currentNode,
    peers,
    diagnostics: {
      liveConnectionAddr,
      liveConnectionGeneration,
      liveConnectionStatus,
    },
    saveConnection,
    activeConnectionAddr,
    canConnect: status !== "loading" && status !== "joining" && status !== "discovering" && serverUrl.trim() !== "",
    connect: async () => {
      if (liveConnectionAddr.trim() === "") {
        return false;
      }
      return (await connectToBootstrap({ input: liveConnectionAddr.trim() })) === true;
    },
    debugConnectPhase,
    debugLastError,
    errorMessage,
    isConnected,
    peerCandidates,
    serverUrl,
    serverUrlInput,
    setServerUrlInput,
    saveServerUrl: async () => saveConnection(serverUrlInput),
    status,
  } satisfies P2PRuntimeState;
}

export function useBrowserP2PRuntime(): P2PRuntimeState {
  return useBrowserP2PRuntimeState();
}
