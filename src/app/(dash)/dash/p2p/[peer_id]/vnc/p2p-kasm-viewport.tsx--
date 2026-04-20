"use client";

import { LoaderCircle, ShieldAlert } from "lucide-react";
import { cn } from "mtxuilib/lib/utils";
import { Alert, AlertDescription, AlertTitle } from "mtxuilib/ui/alert";
import { useEffect, useRef, useState } from "react";
import {
  type PeerCandidate,
  type PeerCapabilityTruth,
  supportsAndroidRemoteControl,
} from "@/lib/p2p/discovery-contracts";
import { Libp2pRfbChannel } from "@/lib/p2p/libp2p-rfb-channel";
import type { BrowserNodeLike } from "@/lib/p2p/libp2p-stream";
import { configureKasmRfbInstance, loadKasmRfb } from "@/lib/p2p/load-kasm-rfb";
import { invokeVncEnsure, openVncStream } from "@/lib/p2p/worker-control";
import {
  classifyP2PVncConnectionError,
  formatP2PVncReconnectDelay,
  getP2PVncReconnectDelayMs,
} from "./vnc-reconnect-policy";
import { getP2PVncViewportCopy, type P2PVncSessionModel, type P2PVncTransportPhase } from "./vnc-session-model";

export type P2PKasmViewportSession = {
  getCurrentNode: () => BrowserNodeLike | null;
  isConnected: boolean;
  model: P2PVncSessionModel;
  peerId: string;
  capabilityTruth: PeerCapabilityTruth | null;
  setTargetErrorMessage: (message: string | null) => void;
  setTransportPhase: (phase: P2PVncTransportPhase) => void;
  targetAddress: string | null;
  targetPeer: PeerCandidate | null;
  targetSessionError: string | null;
  transportPhase: P2PVncTransportPhase;
};

export function P2PKasmViewport({ session }: { session: P2PKasmViewportSession }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const keyboardInputRef = useRef<HTMLTextAreaElement>(null);
  const reconnectAttemptRef = useRef(0);
  const lastScheduledConnectionRef = useRef<{ key: string; node: unknown; phase: string }>({
    key: "",
    node: null,
    phase: "",
  });
  const [connectionRunNonce, setConnectionRunNonce] = useState(0);
  const activeNode = session.getCurrentNode();
  const preferredAddress = session.targetAddress;
  const preferredAddressKey = preferredAddress ?? "";
  const targetPeerId = session.targetPeer?.peerId ?? "";
  const connectionIdentityKey = `${session.isConnected ? "1" : "0"}:${targetPeerId}:${preferredAddressKey}`;
  const viewportCopy = getP2PVncViewportCopy(session.model.phase, session.targetSessionError);
  const blocksAutoReconnect =
    ((session.capabilityTruth?.vnc?.state?.trim().toLowerCase() ?? "") === "unavailable" ||
      supportsAndroidRemoteControl(session.capabilityTruth?.remoteControl)) &&
    session.transportPhase !== "disconnected";

  useEffect(() => {
    if (
      !session.isConnected ||
      session.targetPeer == null ||
      activeNode == null ||
      preferredAddress == null ||
      blocksAutoReconnect
    ) {
      lastScheduledConnectionRef.current = { key: "", node: null, phase: "" };
      return;
    }

    if (!["idle", "disconnected"].includes(session.transportPhase)) {
      lastScheduledConnectionRef.current = {
        key: connectionIdentityKey,
        node: activeNode,
        phase: "",
      };
      return;
    }

    const lastScheduled = lastScheduledConnectionRef.current;
    if (
      lastScheduled.key === connectionIdentityKey &&
      lastScheduled.node === activeNode &&
      lastScheduled.phase === session.transportPhase
    ) {
      return;
    }

    lastScheduledConnectionRef.current = {
      key: connectionIdentityKey,
      node: activeNode,
      phase: session.transportPhase,
    };
    setConnectionRunNonce((value) => value + 1);
  }, [
    activeNode,
    blocksAutoReconnect,
    connectionIdentityKey,
    preferredAddress,
    session.isConnected,
    session.targetPeer,
    session.transportPhase,
  ]);

  useEffect(() => {
    if (connectionRunNonce === 0) {
      return;
    }
    if (!session.isConnected || session.targetPeer == null || activeNode == null) {
      return;
    }
    if (!["idle", "disconnected"].includes(session.transportPhase)) {
      return;
    }
    if (blocksAutoReconnect) {
      return;
    }
    const address = preferredAddress;
    if (address == null) {
      return;
    }
    const container = containerRef.current;
    if (container == null) {
      return;
    }
    const node = activeNode;
    const containerEl = container;

    let cancelled = false;
    let channel: Libp2pRfbChannel | null = null;
    let rfbInstance: {
      disconnect?: () => void;
      addEventListener?: (type: string, handler: (event: any) => void) => void;
    } | null = null;

    async function startViewport(address: string) {
      try {
        if (session.transportPhase === "disconnected") {
          const delayMs = getP2PVncReconnectDelayMs(Math.max(reconnectAttemptRef.current - 1, 0));
          await new Promise((resolve) => window.setTimeout(resolve, delayMs));
          if (cancelled) {
            return;
          }
        }

        session.setTargetErrorMessage(null);
        if (session.targetPeer == null) {
          session.setTransportPhase("waiting_for_target");
          session.setTargetErrorMessage("目标节点还未完成 discovery，出现后会自动进入桌面。");
          return;
        }

        session.setTransportPhase("ensuring_vnc");
        const ensureResult = await invokeVncEnsure({
          address,
          node,
          peerId: session.peerId,
        });
        if (cancelled || ensureResult.resource == null) {
          return;
        }

        session.setTransportPhase("opening_stream");
        const opened = await openVncStream({
          address,
          node,
          peerId: session.peerId,
          resource: ensureResult.resource,
        });
        if (cancelled) {
          await opened.stream.close();
          return;
        }

        channel = new Libp2pRfbChannel({
          protocol: "binary",
          source: opened.source,
          stream: opened.stream,
        });

        const { default: RFB } = await loadKasmRfb();
        containerEl.replaceChildren();
        const keyboardInput = keyboardInputRef.current ?? document.createElement("textarea");
        const rfb = new RFB(
          containerEl,
          keyboardInput,
          channel,
          { shared: true, credentials: { password: null } },
          null,
          true,
        );
        configureKasmRfbInstance(rfb);
        rfbInstance = rfb;
        rfb.clipViewport = true;
        rfb.scaleViewport = true;
        rfb.resizeSession = true;
        rfb.enableQOI = false;

        rfb.addEventListener?.("connect", () => {
          if (!cancelled) {
            reconnectAttemptRef.current = 0;
            session.setTargetErrorMessage(null);
            session.setTransportPhase("ready");
          }
        });
        rfb.addEventListener?.("disconnect", (event: { detail?: { clean?: boolean } }) => {
          if (!cancelled) {
            reconnectAttemptRef.current += 1;
            const retryDelayMs = getP2PVncReconnectDelayMs(reconnectAttemptRef.current - 1);
            session.setTransportPhase("disconnected");
            session.setTargetErrorMessage(
              `${event.detail?.clean === false ? "远端桌面会话已断开。" : "桌面会话已结束。"} ${formatP2PVncReconnectDelay(retryDelayMs)}后自动重试。`,
            );
          }
        });
        rfb.addEventListener?.("securityfailure", () => {
          if (!cancelled) {
            reconnectAttemptRef.current = 0;
            session.setTransportPhase("permission_denied");
            session.setTargetErrorMessage("目标节点拒绝了当前桌面会话权限。");
          }
        });
      } catch (error) {
        if (cancelled) {
          return;
        }

        const decision = classifyP2PVncConnectionError(error);
        if (decision.kind === "permission_denied") {
          reconnectAttemptRef.current = 0;
          session.setTransportPhase("permission_denied");
          session.setTargetErrorMessage(decision.message);
          return;
        }

        if (decision.kind === "wait_for_target") {
          reconnectAttemptRef.current = 0;
          session.setTransportPhase("waiting_for_target");
          session.setTargetErrorMessage(decision.message);
          return;
        }

        if (decision.kind === "fatal") {
          reconnectAttemptRef.current = 0;
          session.setTransportPhase("error");
          session.setTargetErrorMessage(decision.message);
          return;
        }

        reconnectAttemptRef.current += 1;
        const retryDelayMs = getP2PVncReconnectDelayMs(reconnectAttemptRef.current - 1);
        session.setTransportPhase("disconnected");
        session.setTargetErrorMessage(`${decision.message} ${formatP2PVncReconnectDelay(retryDelayMs)}后自动重试。`);
      }
    }

    void startViewport(address);

    return () => {
      cancelled = true;
      rfbInstance?.disconnect?.();
      void channel?.close();
    };
  }, [
    activeNode,
    blocksAutoReconnect,
    connectionRunNonce,
    preferredAddressKey,
    session.isConnected,
    session.peerId,
    session.setTargetErrorMessage,
    session.setTransportPhase,
    targetPeerId,
  ]);

  return (
    <div className="relative h-full min-h-0 w-full overflow-hidden bg-black">
      <div ref={containerRef} className="absolute inset-0 overflow-hidden [&_canvas]:!h-full [&_canvas]:!w-full" />
      <textarea ref={keyboardInputRef} className="sr-only" aria-hidden="true" tabIndex={-1} />

      {session.model.phase === "permission_denied" && viewportCopy ? (
        <div className="relative z-10 flex h-full min-h-0 items-center justify-center p-6">
          <Alert variant="destructive" className="max-w-2xl">
            <ShieldAlert className="size-4" />
            <AlertTitle>{viewportCopy.title}</AlertTitle>
            <AlertDescription>{viewportCopy.detail}</AlertDescription>
          </Alert>
        </div>
      ) : null}

      {session.model.phase !== "ready" && session.model.phase !== "permission_denied" && viewportCopy ? (
        <div className="pointer-events-none absolute [left:calc(0.75rem+env(safe-area-inset-left))] [right:calc(0.75rem+env(safe-area-inset-right))] bottom-[calc(0.75rem+env(safe-area-inset-bottom))] z-10 flex justify-center sm:left-6 sm:right-6 sm:bottom-6">
          <div
            className={cn(
              "flex max-w-lg items-start gap-3 rounded-2xl border border-white/10 bg-black/70 px-4 py-3 text-white shadow-2xl backdrop-blur-md",
              session.targetSessionError ? "border-rose-500/40 text-rose-100" : undefined,
            )}
          >
            <LoaderCircle className="mt-0.5 size-4 shrink-0 animate-spin text-zinc-300" />
            <div className="min-w-0">
              <div className="text-sm font-medium">{viewportCopy.title}</div>
              <div className="mt-1 text-xs text-zinc-300">{viewportCopy.detail}</div>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
