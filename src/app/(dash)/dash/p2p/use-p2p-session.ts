"use client";

import {
  createContext,
  createElement,
  type ReactNode,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import { useRpcQuery } from "mtmsdk/supabase/use-sb-query/use-rpc-query";
import {
  getServerAccessUrl,
  serverInstanceListSchema,
  type ServerInstanceStatusDto,
} from "@/components/server-instance/status-contract";
import type { PeerCandidate, PeerCapabilityTruth } from "@/lib/p2p/discovery-contracts";
import {
  type BrowserNodeLike,
  getPreferredBrowserConnectionPath,
  pickDialableBrowserAddress,
} from "@/lib/p2p/libp2p-stream";
import {
  type BrowserRendezvousDiscoveryService,
  GOMTM_RENDEZVOUS_NAMESPACE,
  gomtmRendezvousDiscovery,
} from "@/lib/p2p/rendezvous-discovery";
import { logP2PConsole, summarizePeerCandidates } from "@/lib/p2p/p2p-console";
import { requestPeerCapabilityTruth, WorkerControlRequestError } from "@/lib/p2p/worker-control";

const BOOTSTRAP_STORAGE_KEY = "gomtm:p2p:bootstrap-target";
const BROWSER_IDENTITY_STORAGE_KEY = "gomtm:p2p:browser-identity-v1";
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

type StoredBootstrapTarget = {
  bootstrapAddr?: string;
};

type ResolvedBootstrapTarget = {
  bootstrapAddr: string;
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
  fetchSuggestedBootstrapTarget: (statusUrl?: string | null) => Promise<StoredBootstrapTarget>;
  getCurrentPageHostname: typeof getCurrentPageHostname;
  readStoredBootstrapTarget: typeof readStoredBootstrapTarget;
  writeStoredBootstrapTarget: typeof writeStoredBootstrapTarget;
};

const defaultP2PSessionDeps: P2PSessionDeps = {
  assertBrowserP2PSupport,
  createBrowserNode,
  fetchSuggestedBootstrapTarget,
  getCurrentPageHostname,
  readStoredBootstrapTarget,
  writeStoredBootstrapTarget,
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

export function shouldAllowPrivateBootstrapMultiaddr(candidate: string, bootstrapAddr: string) {
  return (
    normalizeBrowserBootstrapAddr(candidate) !== "" &&
    normalizeBrowserBootstrapAddr(candidate) === normalizeBrowserBootstrapAddr(bootstrapAddr)
  );
}

export function normalizeBrowserBootstrapAddr(value: string) {
  const trimmed = value.trim();
  if (trimmed === "" || !trimmed.includes("/webtransport") || !trimmed.includes("/certhash/")) {
    return trimmed;
  }

  const segments = trimmed.split("/");
  const normalized: string[] = [];
  let seenCertHash = false;
  for (let index = 0; index < segments.length; index += 1) {
    const segment = segments[index];
    if (segment !== "certhash") {
      normalized.push(segment);
      continue;
    }
    const hashValue = segments[index + 1];
    if (hashValue == null) {
      break;
    }
    if (!seenCertHash) {
      normalized.push(segment, hashValue);
      seenCertHash = true;
    }
    index += 1;
  }

  return normalized.join("/");
}

function getCurrentPageHostname() {
  if (typeof window === "undefined") {
    return "";
  }
  return window.location.hostname.trim().toLowerCase();
}

export function getLocalhostLoopbackBootstrapAddr(value: string, hostname: string) {
  void value;
  void hostname;
  return null;
}

export function getBootstrapDialTargets(value: string, hostname: string) {
  const primary = normalizeBrowserBootstrapAddr(value);
  if (primary === "") {
    return [];
  }
  void hostname;
  return [primary];
}

function readStoredBootstrapTarget(): StoredBootstrapTarget {
  if (typeof window === "undefined") {
    return {};
  }

  try {
    const raw = window.localStorage.getItem(BOOTSTRAP_STORAGE_KEY);
    if (raw != null) {
      const parsed = JSON.parse(raw) as { bootstrap_addr?: unknown };
      const bootstrapAddr =
        typeof parsed.bootstrap_addr === "string" ? normalizeBrowserBootstrapAddr(parsed.bootstrap_addr) : "";
      return bootstrapAddr === "" ? {} : { bootstrapAddr };
    }
  } catch {
    // localStorage 不可用时直接回退到运行时默认值
  }

  return {};
}

function persistStoredBootstrapTarget(target: StoredBootstrapTarget) {
  if (typeof window === "undefined") {
    return;
  }

  try {
    if ((target.bootstrapAddr?.trim() ?? "") === "") {
      window.localStorage.removeItem(BOOTSTRAP_STORAGE_KEY);
      return;
    }

    window.localStorage.setItem(BOOTSTRAP_STORAGE_KEY, JSON.stringify({ bootstrap_addr: target.bootstrapAddr }));
  } catch {
    // best effort only
  }
}

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

export function readStoredBrowserIdentity() {
  if (typeof window === "undefined") {
    return null;
  }

  try {
    const raw = window.localStorage.getItem(BROWSER_IDENTITY_STORAGE_KEY);
    if (raw == null || raw.trim() === "") {
      return null;
    }
    const parsed = JSON.parse(raw) as { private_key_base64?: unknown };
    const privateKeyBase64 = typeof parsed.private_key_base64 === "string" ? parsed.private_key_base64.trim() : "";
    return privateKeyBase64 === "" ? null : privateKeyBase64;
  } catch {
    return null;
  }
}

export function persistStoredBrowserIdentity(privateKeyBase64: string | null) {
  if (typeof window === "undefined") {
    return;
  }

  try {
    const normalized = privateKeyBase64?.trim() ?? "";
    if (normalized === "") {
      window.localStorage.removeItem(BROWSER_IDENTITY_STORAGE_KEY);
      return;
    }
    window.localStorage.setItem(BROWSER_IDENTITY_STORAGE_KEY, JSON.stringify({ private_key_base64: normalized }));
  } catch {
    // best effort only
  }
}

async function loadOrCreateBrowserPrivateKey() {
  const [{ keys }] = await Promise.all([import("@libp2p/crypto")]);
  const storedKey = readStoredBrowserIdentity();
  if (storedKey != null) {
    try {
      return keys.privateKeyFromProtobuf(decodeBase64(storedKey));
    } catch {
      persistStoredBrowserIdentity(null);
    }
  }

  const privateKey = await keys.generateKeyPair("Ed25519");
  persistStoredBrowserIdentity(encodeBase64(keys.privateKeyToProtobuf(privateKey)));
  return privateKey;
}

function writeStoredBootstrapTarget(target: { bootstrapAddr: string }) {
  const nextTarget = { bootstrapAddr: normalizeBrowserBootstrapAddr(target.bootstrapAddr) || undefined };
  persistStoredBootstrapTarget(nextTarget);
  return nextTarget;
}

function getSuggestedBootstrapStatusUrl(instances: ReadonlyArray<ServerInstanceStatusDto> | null | undefined) {
  for (const instance of instances ?? []) {
    const accessUrl = getServerAccessUrl(instance.status, instance.hostname);
    if (accessUrl) {
      return new URL("/api/system/status", accessUrl).toString();
    }
  }
  return null;
}

async function fetchSuggestedBootstrapTarget(statusUrl?: string | null): Promise<StoredBootstrapTarget> {
  const normalizedStatusUrl = statusUrl?.trim() ?? "";
  if (typeof window === "undefined" || normalizedStatusUrl === "") {
    return {};
  }
  try {
    const response = await fetch(normalizedStatusUrl, { cache: "no-store" });
    if (!response.ok) {
      return {};
    }
    const payload = (await response.json()) as { suggested_browser_bootstrap_addr?: unknown };
    const bootstrapAddr =
      typeof payload.suggested_browser_bootstrap_addr === "string"
        ? normalizeBrowserBootstrapAddr(payload.suggested_browser_bootstrap_addr)
        : "";
    return bootstrapAddr === "" ? {} : { bootstrapAddr };
  } catch {
    return {};
  }
}

function shouldRetryWithSuggestedBootstrap(params: { storedBootstrapAddr: string; suggestedBootstrapAddr: string }) {
  const storedBootstrapAddr = normalizeBrowserBootstrapAddr(params.storedBootstrapAddr) || "";
  const suggestedBootstrapAddr = normalizeBrowserBootstrapAddr(params.suggestedBootstrapAddr) || "";
  if (storedBootstrapAddr === "" || suggestedBootstrapAddr === "") {
    return false;
  }
  return storedBootstrapAddr !== suggestedBootstrapAddr;
}

function resolveBootstrapTarget(input: string): ResolvedBootstrapTarget {
  const trimmed = normalizeBrowserBootstrapAddr(input);
  if (trimmed === "") {
    throw new Error("missing bootstrap input");
  }
  if (!trimmed.startsWith("/")) {
    throw new Error("bootstrap 地址必须使用完整 auto_bootstrap multiaddr。");
  }
  if (!trimmed.includes("/webtransport") || !trimmed.includes("/p2p/")) {
    throw new Error("bootstrap 地址必须是浏览器可拨的 WebTransport multiaddr（包含 /webtransport 与 /p2p）。");
  }
  return { bootstrapAddr: trimmed };
}

export function describeBootstrapJoinError(input: { bootstrapAddr: string; error: unknown }) {
  const message = input.error instanceof Error ? input.error.message.trim() : String(input.error).trim();
  if (
    message === "Connection lost." ||
    message === "Opening handshake failed." ||
    message === "failed to create browser node"
  ) {
    return `浏览器当前网络环境未能与 bootstrap 建立 WebTransport 握手（${message}）。这通常不是 Android 节点本身掉线，而是当前浏览器的代理、VPN、抓包扩展或 HTTPS 隧道拦截了 ${input.bootstrapAddr}；请先在当前浏览器禁用相关代理/扩展，或为该地址添加直连白名单后重试。`;
  }
  return message;
}

function assertBrowserP2PSupport() {
  if (!window.isSecureContext) {
    throw new Error("当前页面不是安全上下文，浏览器无法建立 WebTransport 连接。");
  }
  if (!("WebTransport" in window)) {
    throw new Error("当前浏览器不支持 WebTransport。");
  }
}

async function createBrowserNode(rendezvousPoint: string) {
  const [
    { createLibp2p },
    { webTransport },
    { circuitRelayTransport },
    { noise },
    { yamux },
    { identify },
    { isPrivate },
  ] = await Promise.all([
    import("libp2p"),
    import("@libp2p/webtransport"),
    import("@libp2p/circuit-relay-v2"),
    import("@chainsafe/libp2p-noise"),
    import("@chainsafe/libp2p-yamux"),
    import("@libp2p/identify"),
    import("@libp2p/utils"),
  ]);

  const privateKey = await loadOrCreateBrowserPrivateKey();

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
    transports: [webTransport(), circuitRelayTransport()],
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

function useP2PSessionState(options?: { suggestedBootstrapStatusUrl?: string | null }) {
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

      try {
        p2pSessionDeps.assertBrowserP2PSupport();
      } catch (error) {
        if (!isCurrentAttempt()) {
          return;
        }
        const message = error instanceof Error ? error.message : String(error);
        setStatus("error");
        setErrorMessage(message);
        return false;
      }

      const rawInput = options.input.trim();
      if (rawInput === "") {
        setStatus("needs-bootstrap");
        setErrorMessage("请输入完整 auto_bootstrap multiaddr。");
        return false;
      }

      try {
        target = resolveBootstrapTarget(rawInput);
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        setStatus("needs-bootstrap");
        setErrorMessage(message);
        return false;
      }

      await stopNode({ invalidateAttempt: false });
      if (!isCurrentAttempt()) {
        return;
      }
      peerTruthRetryStateRef.current = {};
      updateResolvedPeerTruth({});
      setStatus("joining");
      setErrorMessage(null);
      setPeerCandidates([]);
      logP2PConsole("info", "正在加入 P2P 网络", target, { verboseOnly: true });

      try {
        const dialTargets = getBootstrapDialTargets(target.bootstrapAddr, p2pSessionDeps.getCurrentPageHostname());
        let node: Awaited<ReturnType<typeof createBrowserNode>> | null = null;
        let lastDialError: unknown = null;
        for (const dialTarget of dialTargets) {
          try {
            node = await p2pSessionDeps.createBrowserNode(dialTarget);
            if (dialTarget !== target.bootstrapAddr) {
              target = { bootstrapAddr: dialTarget };
            }
            break;
          } catch (error) {
            lastDialError = error;
          }
        }
        if (node == null) {
          throw lastDialError ?? new Error("failed to create browser node");
        }
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
        setActiveBootstrapAddr(target.bootstrapAddr);
        setStatus("discovering");
        await syncPeerCandidates(node);
        if (!isCurrentAttempt()) {
          await stopCreatedNode();
          return;
        }
        setStatus("peer_candidates_ready");

        setBootstrapInput(target.bootstrapAddr);
        p2pSessionDeps.writeStoredBootstrapTarget({ bootstrapAddr: target.bootstrapAddr });
        logP2PConsole("info", "已接入 P2P 网络", {
          bootstrapAddr: target.bootstrapAddr,
          peerCandidates: (await discovery.listPeerCandidates()).length,
        }, { verboseOnly: true });
        return true;
      } catch (error) {
        if (!isCurrentAttempt()) {
          await stopCreatedNode();
          return;
        }
        const message = describeBootstrapJoinError({ bootstrapAddr: target.bootstrapAddr, error });
        logP2PConsole("error", "接入 P2P 网络失败", message);
        await stopNode({ invalidateAttempt: false });
        setActiveBootstrapAddr("");
        setPeerCandidates([]);
        updateResolvedPeerTruth({});
        setStatus("error");
        setErrorMessage(message);
        return false;
      }
    },
    [stopNode, syncPeerCandidates, updateResolvedPeerTruth],
  );

  useEffect(() => {
    let cancelled = false;

    async function init() {
      const storedTarget = p2pSessionDeps.readStoredBootstrapTarget();
      let suggestedTarget: StoredBootstrapTarget = storedTarget.bootstrapAddr?.trim()
        ? {}
        : await p2pSessionDeps.fetchSuggestedBootstrapTarget(options?.suggestedBootstrapStatusUrl);
      const initialInput = (storedTarget.bootstrapAddr?.trim() || suggestedTarget.bootstrapAddr?.trim() || "").trim();
      if (cancelled) {
        return;
      }

      setBootstrapInput(initialInput);

      if (initialInput !== "") {
        if (cancelled) {
          return;
        }

        const connected = await connectToBootstrap({ input: initialInput });
        if (cancelled || connected) {
          return;
        }
        if (storedTarget.bootstrapAddr?.trim() && !(suggestedTarget.bootstrapAddr?.trim() ?? "")) {
          suggestedTarget = await p2pSessionDeps.fetchSuggestedBootstrapTarget(options?.suggestedBootstrapStatusUrl);
        }
        if (
          shouldRetryWithSuggestedBootstrap({
            storedBootstrapAddr: storedTarget.bootstrapAddr ?? "",
            suggestedBootstrapAddr: suggestedTarget.bootstrapAddr ?? "",
          })
        ) {
          const fallbackInput = suggestedTarget.bootstrapAddr?.trim() ?? "";
          if (fallbackInput !== "") {
            setBootstrapInput(fallbackInput);
            await connectToBootstrap({ input: fallbackInput });
          }
        }
        return;
      }

      setStatus("needs-bootstrap");
    }

    void init();

    return () => {
      cancelled = true;
      void stopNode();
    };
  }, [connectToBootstrap, options?.suggestedBootstrapStatusUrl, stopNode]);

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
  const serverInstancesQuery = useRpcQuery(
    "server_list_cursor",
    { p_limit: 20 },
    {
      schema: serverInstanceListSchema,
    },
  );
  const value = useP2PSessionState({
    suggestedBootstrapStatusUrl: getSuggestedBootstrapStatusUrl(serverInstancesQuery.data),
  });
  return createElement(P2PSessionContext.Provider, { value }, children);
}

export function useP2PSession() {
  const value = useContext(P2PSessionContext);
  if (value == null) {
    throw new Error("useP2PSession must be used within P2PSessionProvider");
  }
  return value;
}
