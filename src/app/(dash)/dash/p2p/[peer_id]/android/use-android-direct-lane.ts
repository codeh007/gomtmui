"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  type AndroidDirectReadyChannelSession,
  type AndroidDirectRequestFrame,
  type AndroidDirectResponseFrame,
  createAndroidDirectRequestClient,
  DIRECT_REQUEST_DATA_CHANNEL_LABEL,
  DIRECT_WEBRTC_SIGNAL_PROTOCOL,
} from "@/lib/p2p/android-direct-request-client";
import type { BrowserNodeLike } from "@/lib/p2p/libp2p-stream";
import { STALE_ATTEMPT_REASON, summarizeDirectConnectionStats } from "./android-direct-lane-summary";

export type AndroidDirectLaneState = "idle" | "signaling" | "direct_ready" | "direct_not_established";

const DIRECT_DRIVER_INFO_PATH = "/api/driver_info";

type AndroidDirectLaneResult =
  | {
      path: "direct";
      session: AndroidDirectReadyChannelSession;
    }
  | {
      path: "failed" | "fallback";
      reason: string;
    };

function resolveDirectFailure(reason: string): AndroidDirectLaneResult {
  return {
    path: "failed",
    reason,
  };
}

export function useAndroidDirectLane(input: {
  address: string | null;
  node: () => BrowserNodeLike | null;
  peerId: string;
}) {
  const client = useMemo(() => createAndroidDirectRequestClient(), []);
  const [candidatePairSummary, setCandidatePairSummary] = useState<string | null>(null);
  const [directEvidenceSummary, setDirectEvidenceSummary] = useState<string | null>(null);
  const [state, setState] = useState<AndroidDirectLaneState>("idle");
  const [lastError, setLastError] = useState<string | null>(null);
  const [lastResult, setLastResult] = useState<unknown>(null);
  const activeSessionRef = useRef<AndroidDirectReadyChannelSession | null>(null);
  const attemptIdRef = useRef(0);
  const disposedRef = useRef(false);
  const pendingAttemptAbortControllerRef = useRef<AbortController | null>(null);

  async function closeSession(session: AndroidDirectReadyChannelSession | null) {
    if (session == null) {
      return;
    }
    await session.close().catch(() => undefined);
  }

  async function replaceActiveSession(session: AndroidDirectReadyChannelSession | null) {
    const previousSession = activeSessionRef.current;
    activeSessionRef.current = session;
    if (previousSession === session) {
      return;
    }
    await closeSession(previousSession);
  }

  function abortPendingAttempt() {
    const controller = pendingAttemptAbortControllerRef.current;
    pendingAttemptAbortControllerRef.current = null;
    controller?.abort();
  }

  useEffect(() => {
    disposedRef.current = false;

    return () => {
      disposedRef.current = true;
      attemptIdRef.current += 1;
      abortPendingAttempt();
      const session = activeSessionRef.current;
      activeSessionRef.current = null;
      void closeSession(session);
    };
  }, []);

  async function execute(): Promise<AndroidDirectLaneResult> {
    const attemptId = attemptIdRef.current + 1;
    const abortController = new AbortController();
    const previousPendingAttempt = pendingAttemptAbortControllerRef.current;
    attemptIdRef.current = attemptId;
    pendingAttemptAbortControllerRef.current = abortController;
    previousPendingAttempt?.abort();
    setState("signaling");
    setCandidatePairSummary(null);
    setDirectEvidenceSummary(null);
    setLastError(null);
    setLastResult(null);
    await replaceActiveSession(null);

    if (disposedRef.current || attemptId !== attemptIdRef.current || abortController.signal.aborted) {
      if (pendingAttemptAbortControllerRef.current === abortController) {
        pendingAttemptAbortControllerRef.current = null;
      }
      return resolveDirectFailure(STALE_ATTEMPT_REASON);
    }

    if (input.address == null) {
      if (pendingAttemptAbortControllerRef.current === abortController) {
        pendingAttemptAbortControllerRef.current = null;
      }
      const reason = "目标节点当前没有 browser-dialable multiaddr，无法建立 direct lane。";
      setState("direct_not_established");
      setLastError(reason);
      setLastResult(null);
      return resolveDirectFailure(reason);
    }

    const node = input.node();
    if (node == null) {
      if (pendingAttemptAbortControllerRef.current === abortController) {
        pendingAttemptAbortControllerRef.current = null;
      }
      const reason = "当前浏览器节点尚未就绪，无法建立 direct lane。";
      setState("direct_not_established");
      setLastError(reason);
      setLastResult(null);
      return resolveDirectFailure(reason);
    }

    setState("signaling");

    try {
      const session = await client.connect({
        address: input.address,
        node,
        peerId: input.peerId,
        signal: abortController.signal,
      });

      if (pendingAttemptAbortControllerRef.current === abortController) {
        pendingAttemptAbortControllerRef.current = null;
      }

      if (disposedRef.current || attemptId !== attemptIdRef.current) {
        await closeSession(session);
        return resolveDirectFailure(STALE_ATTEMPT_REASON);
      }

      const response = await session.request({
        method: "GET",
        path: DIRECT_DRIVER_INFO_PATH,
        signal: abortController.signal,
      });
      const statsSummary = summarizeDirectConnectionStats(await session.getStats());
      const requestResult = {
        body: response.body,
        channelLabel: DIRECT_REQUEST_DATA_CHANNEL_LABEL,
        channelReadyState: session.channel.readyState ?? "unknown",
        directReady: statsSummary.isDirect,
        peerId: input.peerId,
        phase: "request_succeeded",
        protocol: DIRECT_WEBRTC_SIGNAL_PROTOCOL,
        requestId: response.id,
        requestPath: DIRECT_DRIVER_INFO_PATH,
        sessionStatus: "ready",
        status: response.status,
      };
      setCandidatePairSummary(statsSummary.candidatePairSummary);
      setDirectEvidenceSummary(statsSummary.directEvidenceSummary);
      setLastResult(requestResult);

      if (!statsSummary.isDirect) {
        await closeSession(session);
        setState("direct_not_established");
        setLastError(statsSummary.reason);
        return resolveDirectFailure(statsSummary.reason);
      }

      activeSessionRef.current = session;

      setState("direct_ready");
      setLastError(null);

      return {
        path: "direct",
        session,
      };
    } catch (error) {
      if (pendingAttemptAbortControllerRef.current === abortController) {
        pendingAttemptAbortControllerRef.current = null;
      }
      const reason = error instanceof Error ? error.message : String(error);

      if (disposedRef.current || attemptId !== attemptIdRef.current) {
        return resolveDirectFailure(STALE_ATTEMPT_REASON);
      }

      setState("direct_not_established");
      setLastError(reason);
      setLastResult(null);
      return resolveDirectFailure(reason);
    }
  }

  async function ensureDirectSession() {
    const activeSession = activeSessionRef.current;
    if (activeSession?.channel.readyState === "open") {
      return activeSession;
    }

    await replaceActiveSession(null);
    const result = await execute();
    if (result.path !== "direct") {
      throw new Error(result.reason);
    }
    return result.session;
  }

  async function requestDirect(input: AndroidDirectRequestFrame): Promise<AndroidDirectResponseFrame> {
    const session = await ensureDirectSession();
    try {
      const response = await session.request(input);
      setState("direct_ready");
      setLastError(null);
      return response;
    } catch (error) {
      const reason = error instanceof Error ? error.message : String(error);
      await replaceActiveSession(null);
      setState("direct_not_established");
      setLastError(reason);
      throw error;
    }
  }

  return {
    candidatePairSummary,
    directEvidenceSummary,
    lastError,
    lastResult,
    requestDirect,
    runDirectExperiment: () => execute(),
    state,
  };
}
