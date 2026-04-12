"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  ANDROID_SCRCPY_SESSION_MODULE_GENERATION,
  AndroidDeviceOpError,
  type AndroidDeviceOpName,
  type AndroidDeviceOpState,
  type AndroidScrcpyLiveSession,
  type AndroidScrcpyPerformanceProfile,
  type AndroidScrcpySessionSnapshot,
  createAndroidScrcpySessionService,
  resolveAndroidScrcpyPerformanceTuning,
} from "@/lib/p2p/android-scrcpy-session";
import type { PeerCandidate, PeerCapabilityTruth } from "@/lib/p2p/discovery-contracts";
import type { BrowserNodeLike } from "@/lib/p2p/libp2p-stream";
import { AndroidRemoteCanvas } from "./android-remote-canvas";
import type { P2PAndroidSessionModel, P2PAndroidTransportPhase } from "./android-session-model";
import { supportsAndroidScrcpyBrowser } from "./browser-capability";
import {
  ANDROID_MOTION_ACTION_CANCEL,
  ANDROID_MOTION_ACTION_UP,
  type ScrcpyTouchPayload,
} from "./p2p-android-viewport-gesture";
import { P2PAndroidViewportStage } from "./p2p-android-viewport-stage";
import {
  ANDROID_KEY_CODE_APP_SWITCH,
  ANDROID_KEY_CODE_BACK,
  ANDROID_KEY_CODE_HOME,
  type AndroidDeviceOpNotice,
  type AndroidScrcpyControllerLike,
  type AndroidScrcpyVideoStreamLike,
  type AndroidSessionInfoItem,
  BUSY_MESSAGE,
  CONNECTED_MESSAGE,
  CONNECTING_MESSAGE,
  createScrcpyCanvasRenderer,
  createSnapshot,
  DEFAULT_VIEWPORT_SIZE,
  describeDeviceOpState,
  ERROR_MESSAGE,
  formatConnectElapsed,
  getViewportSize,
  isAvailableDeviceOpState,
  isTransientAndroidControlStreamClosingError,
  MISSING_DEVICE_OPS_MESSAGE,
  paintCanvasBlack,
  RECONNECTING_MESSAGE,
  STREAM_ENDED_MESSAGE,
  syncCanvasSize,
  toRemoteStatus,
  UNSUPPORTED_BROWSER_MESSAGE,
  type ViewportSize,
} from "./p2p-android-viewport-support";
import {
  buildDeviceOpHints,
  buildDirectExperimentView,
  buildSessionDebugItems,
  buildSessionInfoItems,
} from "./p2p-android-viewport-view-model";
import { useAndroidDeviceActions } from "./use-android-device-actions";
import type { AndroidDirectLaneState } from "./use-android-direct-lane";
import { useAndroidKeyboardBridge } from "./use-android-keyboard-bridge";
import { useAndroidPointerBridge } from "./use-android-pointer-bridge";

type PlaywrightAndroidServiceFactory = (params: {
  address: string;
  node: BrowserNodeLike;
  peerId: string;
  profile: AndroidScrcpyPerformanceProfile;
  workerPeerId: string;
}) => ReturnType<typeof createAndroidScrcpySessionService> | null;

export type P2PAndroidViewportSession = {
  candidatePairSummary?: string | null;
  capabilityTruth: PeerCapabilityTruth | null;
  controllerPeerId: string | null;
  directEvidenceSummary?: string | null;
  getCurrentNode: () => BrowserNodeLike | null;
  isConnected: boolean;
  lastError?: string | null;
  lastResult?: unknown;
  model: P2PAndroidSessionModel;
  peerId: string;
  refreshPeerTruth: () => void;
  runDirectExperiment?: () => Promise<{ path: string; reason?: string }>;
  state?: AndroidDirectLaneState;
  targetAddress: string | null;
  targetPeer: PeerCandidate | null;
  targetSessionError: string | null;
  transportPhase: P2PAndroidTransportPhase;
};

const ANDROID_VIEWPORT_MODULE_GENERATION = `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
const ANDROID_VIEWPORT_RUNTIME_GENERATION = [
  ANDROID_VIEWPORT_MODULE_GENERATION,
  ANDROID_SCRCPY_SESSION_MODULE_GENERATION,
].join(":");
const AUTO_RECOVERY_RETRY_DELAYS_MS = [0, 1500, 4000] as const;

function getPlaywrightAndroidServiceOverride(): PlaywrightAndroidServiceFactory | null {
  if (typeof window === "undefined") {
    return null;
  }

  const override = (
    window as Window & {
      __gomtmPlaywrightAndroid?: {
        createService?: PlaywrightAndroidServiceFactory;
      };
    }
  ).__gomtmPlaywrightAndroid?.createService;

  return typeof override === "function" ? override : null;
}

export function P2PAndroidViewport({ session }: { session: P2PAndroidViewportSession }) {
  const [snapshot, setSnapshot] = useState<AndroidScrcpySessionSnapshot>(createSnapshot("idle"));
  const [liveSession, setLiveSession] = useState<AndroidScrcpyLiveSession | null>(null);
  const [autoRecoveryPending, setAutoRecoveryPending] = useState(false);
  const [sessionTargetAddress, setSessionTargetAddress] = useState<string | null>(session.targetAddress);
  const [deviceOpNotice, setDeviceOpNotice] = useState<AndroidDeviceOpNotice | null>(null);
  const [deviceOpOverrides, setDeviceOpOverrides] = useState<
    Partial<Record<AndroidDeviceOpName, AndroidDeviceOpState>>
  >({});
  const [viewportSize, setViewportSize] = useState<ViewportSize>(DEFAULT_VIEWPORT_SIZE);
  const [connectNonce, setConnectNonce] = useState(0);
  const [performanceProfile, setPerformanceProfile] = useState<AndroidScrcpyPerformanceProfile>("low");
  const activePointerIdRef = useRef<number | null>(null);
  const moduleGenerationRef = useRef(ANDROID_VIEWPORT_RUNTIME_GENERATION);
  const nextConnectModeRef = useRef<"connect" | "recover" | "user-reconnect">("connect");
  const reconnectInFlightRef = useRef(false);
  const autoRecoveryAttemptRef = useRef(0);
  const autoRecoveryTimerRef = useRef<ReturnType<typeof globalThis.setTimeout> | null>(null);
  const keyboardInputRef = useRef<HTMLTextAreaElement>(null);
  const touchDispatchStateRef = useRef<{
    generation: number;
    inFlight: boolean;
    pending: ScrcpyTouchPayload | null;
  }>({
    generation: 0,
    inFlight: false,
    pending: null,
  });
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const serviceRef = useRef<ReturnType<typeof createAndroidScrcpySessionService> | null>(null);
  const rendererCleanupRef = useRef<((mode?: "hard" | "soft") => Promise<void>) | null>(null);
  const activeNode = session.getCurrentNode();
  const targetAddress = sessionTargetAddress;
  const controllerPeerId = session.controllerPeerId;
  const targetPeerId = session.targetPeer?.peerId ?? session.peerId;
  const blockedSessionPhase =
    session.model.phase === "adb_endpoint_unavailable" ||
    session.model.phase === "controller_occupied" ||
    session.model.phase === "session_error" ||
    session.model.phase === "unsupported_browser" ||
    session.model.phase === "waiting_for_target"
      ? session.model.phase
      : null;
  const blockedSessionMessage = blockedSessionPhase == null ? undefined : (session.targetSessionError ?? undefined);
  const manualReconnectPending = nextConnectModeRef.current === "user-reconnect";
  const canStartSession =
    session.isConnected &&
    activeNode != null &&
    targetAddress != null &&
    session.targetPeer != null &&
    controllerPeerId != null &&
    (blockedSessionPhase == null || (blockedSessionPhase === "controller_occupied" && manualReconnectPending));
  const supportedBrowser = supportsAndroidScrcpyBrowser();

  const remoteStatus = useMemo(
    () => toRemoteStatus(snapshot, session.targetSessionError),
    [session.targetSessionError, snapshot],
  );
  const uiRemoteStatus =
    autoRecoveryPending && (remoteStatus.label === "Reconnecting" || remoteStatus.label === "Error")
      ? {
          ...remoteStatus,
          detail: CONNECTED_MESSAGE,
          label: "Connected" as const,
          showBusyIndicator: false,
        }
      : remoteStatus;
  const resolvedPerformanceProfile = snapshot.profile ?? performanceProfile;
  const performanceTuning = resolveAndroidScrcpyPerformanceTuning(resolvedPerformanceProfile);

  const controlsEnabled = uiRemoteStatus.label === "Connected" && liveSession?.scrcpy.controller != null;
  const rotateState = getDeviceOpState("rotate");
  const screenshotState = getDeviceOpState("captureScreenshot");
  const clipboardState = getDeviceOpState("writeClipboard");
  const rotateEnabled = uiRemoteStatus.label === "Connected" && isAvailableDeviceOpState(rotateState);
  const screenshotEnabled = uiRemoteStatus.label === "Connected" && isAvailableDeviceOpState(screenshotState);
  const textActionsEnabled =
    uiRemoteStatus.label === "Connected" && (controlsEnabled || isAvailableDeviceOpState(clipboardState));
  const shouldRenderCanvas =
    liveSession != null && remoteStatus.label !== "Busy" && remoteStatus.label !== "Unsupported";

  function clearAutoRecoveryTimer() {
    if (autoRecoveryTimerRef.current != null) {
      globalThis.clearTimeout(autoRecoveryTimerRef.current);
      autoRecoveryTimerRef.current = null;
    }
  }

  function resetAutoRecovery() {
    autoRecoveryAttemptRef.current = 0;
    setAutoRecoveryPending(false);
    clearAutoRecoveryTimer();
  }

  function scheduleAutoRecovery(message: string) {
    if (autoRecoveryAttemptRef.current >= AUTO_RECOVERY_RETRY_DELAYS_MS.length) {
      setAutoRecoveryPending(false);
      return false;
    }
    const attemptIndex = autoRecoveryAttemptRef.current;
    autoRecoveryAttemptRef.current += 1;
    setAutoRecoveryPending(true);
    setSnapshot(createSnapshot("reconnecting", message));
    clearAutoRecoveryTimer();
    autoRecoveryTimerRef.current = globalThis.setTimeout(() => {
      autoRecoveryTimerRef.current = null;
      void reconnectSession({
        autoRecoveryAttempt: attemptIndex + 1,
        message,
      });
    }, AUTO_RECOVERY_RETRY_DELAYS_MS[attemptIndex]);
    return true;
  }

  useEffect(() => {
    const shouldPinCurrentAddress =
      liveSession != null ||
      serviceRef.current != null ||
      reconnectInFlightRef.current ||
      snapshot.status === "connecting" ||
      snapshot.status === "reconnecting";
    if (shouldPinCurrentAddress) {
      return;
    }

    setSessionTargetAddress((current) => {
      const next = session.targetAddress ?? null;
      return current === next ? current : next;
    });
  }, [liveSession?.sessionId, session.targetAddress, snapshot.status]);

  function resetTouchDispatchState() {
    const state = touchDispatchStateRef.current;
    state.generation += 1;
    state.inFlight = false;
    state.pending = null;
  }

  function setSessionError(message: string) {
    resetAutoRecovery();
    resetTouchDispatchState();
    const nextSnapshot = createSnapshot("error", message);
    setSnapshot(nextSnapshot);
    setLiveSession(null);
    const staleService = serviceRef.current;
    serviceRef.current = null;
    void staleService?.close().catch(() => undefined);
  }

  function getDeviceOps() {
    return liveSession?.deviceOps ?? null;
  }

  function getDeviceOpState(op: AndroidDeviceOpName): AndroidDeviceOpState {
    const override = deviceOpOverrides[op];
    if (override != null) {
      return override;
    }

    const liveState = liveSession?.deviceOps?.status?.[op];
    if (liveState != null) {
      return liveState;
    }

    return {
      code: "unavailable",
      message: MISSING_DEVICE_OPS_MESSAGE,
    };
  }

  function setDeviceOpStatusNotice(op: AndroidDeviceOpName, state: AndroidDeviceOpState) {
    const hint = describeDeviceOpState(op, state, { controlsEnabled });
    setDeviceOpNotice({
      detail: hint.detail,
      title: hint.title,
      tone: hint.tone,
    });
  }

  function handleDeviceOpError(op: AndroidDeviceOpName, error: unknown) {
    const deviceOpError =
      error instanceof AndroidDeviceOpError
        ? error
        : new AndroidDeviceOpError(op, "failed", error instanceof Error ? error.message : "操作失败。");
    const nextState: AndroidDeviceOpState = {
      code: deviceOpError.code,
      message: deviceOpError.message,
    };

    if (deviceOpError.code !== "failed") {
      setDeviceOpOverrides((current) => ({
        ...current,
        [op]: nextState,
      }));
    }

    setDeviceOpStatusNotice(op, nextState);
  }

  async function waitForCanvasElement() {
    for (let attempt = 0; attempt < 10; attempt += 1) {
      const canvas = canvasRef.current;
      if (canvas != null) {
        return canvas;
      }

      await new Promise((resolve) => window.setTimeout(resolve, 0));
    }

    return null;
  }

  async function attachResolvedVideoStream(videoStream: AndroidScrcpyVideoStreamLike) {
    setViewportSize(getViewportSize(videoStream));

    const canvas = await waitForCanvasElement();
    if (canvas == null) {
      throw new Error("当前浏览器无法挂载 Android scrcpy 画布。");
    }

    syncCanvasSize(canvas, getViewportSize(videoStream));
    const renderer = createScrcpyCanvasRenderer({
      canvas,
      onError: (error) => {
        handleUnexpectedStreamEnd(error instanceof Error ? error.message : ERROR_MESSAGE);
      },
      videoStream,
    });

    let disposed = false;
    const handleUnexpectedStreamEnd = (message: string) => {
      if (disposed) {
        return;
      }
      disposed = true;
      if (reconnectInFlightRef.current) {
        return;
      }
      void reconnectSession({ autoRecoveryAttempt: 1, message });
    };
    const unsubscribe = videoStream.sizeChanged(({ height, width }) => {
      if (!disposed && width > 0 && height > 0) {
        setViewportSize({ height, width });
      }
    });
    const reader = videoStream.stream.getReader();

    const consume = (async () => {
      try {
        while (!disposed) {
          const { done, value } = await reader.read();
          if (done) {
            handleUnexpectedStreamEnd(STREAM_ENDED_MESSAGE);
            break;
          }

          await renderer.renderPacket(value);
        }
      } catch (error) {
        if (!disposed) {
          handleUnexpectedStreamEnd(error instanceof Error ? error.message : STREAM_ENDED_MESSAGE);
        }
      }
    })();

    rendererCleanupRef.current = async (mode = "hard") => {
      disposed = true;
      if (typeof unsubscribe === "function") {
        unsubscribe();
      } else {
        unsubscribe.dispose();
      }
      if (mode === "hard") {
        await reader.cancel().catch(() => undefined);
        await consume.catch(() => undefined);
      }
      await renderer.close().catch(() => undefined);
    };
  }

  useEffect(() => {
    paintCanvasBlack(canvasRef.current, viewportSize);
  }, [liveSession?.sessionId, viewportSize]);

  useEffect(() => {
    async function teardownRenderer() {
      const cleanup = rendererCleanupRef.current;
      rendererCleanupRef.current = null;
      await cleanup?.().catch(() => undefined);
    }

    async function attachVideoStream(nextLiveSession: AndroidScrcpyLiveSession) {
      const videoStream = (await nextLiveSession.scrcpy.videoStream) as AndroidScrcpyVideoStreamLike | undefined;
      if (videoStream == null) {
        return;
      }

      await attachResolvedVideoStream(videoStream);
    }

    const inFlightServiceSnapshot = serviceRef.current?.getSnapshot();
    const shouldPreserveInFlightRecovery =
      inFlightServiceSnapshot != null &&
      (inFlightServiceSnapshot.status === "connecting" || inFlightServiceSnapshot.status === "reconnecting");

    if (!canStartSession) {
      if (shouldPreserveInFlightRecovery) {
        return;
      }
      resetAutoRecovery();
      resetTouchDispatchState();
      setLiveSession(null);
      if (blockedSessionPhase === "controller_occupied") {
        setSnapshot(createSnapshot("busy", blockedSessionMessage ?? BUSY_MESSAGE));
        return;
      }
      if (blockedSessionPhase === "unsupported_browser") {
        setSnapshot(createSnapshot("unsupported", blockedSessionMessage ?? UNSUPPORTED_BROWSER_MESSAGE));
        return;
      }
      if (
        blockedSessionPhase === "adb_endpoint_unavailable" ||
        blockedSessionPhase === "session_error" ||
        blockedSessionPhase === "waiting_for_target"
      ) {
        setSnapshot(createSnapshot("error", blockedSessionMessage ?? ERROR_MESSAGE));
        return;
      }
      setSnapshot(createSnapshot("connecting", blockedSessionMessage ?? CONNECTING_MESSAGE));
      return;
    }

    if (!supportedBrowser) {
      resetAutoRecovery();
      resetTouchDispatchState();
      setLiveSession(null);
      setSnapshot(createSnapshot("unsupported", UNSUPPORTED_BROWSER_MESSAGE));
      nextConnectModeRef.current = "connect";
      return;
    }

    const serviceFactory = getPlaywrightAndroidServiceOverride();
    const connectMode = nextConnectModeRef.current;
    resetAutoRecovery();
    const service =
      serviceFactory?.({
        address: targetAddress,
        node: activeNode,
        peerId: controllerPeerId,
        profile: performanceProfile,
        workerPeerId: targetPeerId,
      }) ??
      createAndroidScrcpySessionService({
        address: targetAddress,
        node: activeNode,
        peerId: controllerPeerId,
        profile: performanceProfile,
        workerPeerId: targetPeerId,
      });
    serviceRef.current = service;
    resetTouchDispatchState();
    setSnapshot(createSnapshot("connecting", CONNECTING_MESSAGE));
    setLiveSession(null);

    let disposed = false;
    let shouldContinueAutoRecovery = false;
    let autoRecoveryMessage = RECONNECTING_MESSAGE;

    void (async () => {
      try {
        const nextLiveSession =
          connectMode === "connect"
            ? await service.connect()
            : await service.reconnect({ allowTakeover: connectMode === "user-reconnect" });
        if (disposed) {
          await service.close().catch(() => undefined);
          return;
        }

        setSnapshot(service.getSnapshot());
        setLiveSession(nextLiveSession);
        session.refreshPeerTruth();
        resetAutoRecovery();
        await teardownRenderer();
        await attachVideoStream(nextLiveSession);
      } catch {
        if (disposed) {
          return;
        }

        const nextSnapshot = service.getSnapshot();
        setSnapshot(nextSnapshot);
        setLiveSession(service.getLiveSession());
        shouldContinueAutoRecovery = connectMode !== "user-reconnect" && nextSnapshot.status === "error";
        autoRecoveryMessage = nextSnapshot.message?.trim() || autoRecoveryMessage;
      } finally {
        if (!disposed && shouldContinueAutoRecovery) {
          scheduleAutoRecovery(autoRecoveryMessage);
        }
        nextConnectModeRef.current = "connect";
      }
    })();

    return () => {
      disposed = true;
      if (serviceRef.current === service) {
        serviceRef.current = null;
      }
      resetTouchDispatchState();
      setLiveSession(null);
      void teardownRenderer();
      void service.close().catch(() => undefined);
    };
  }, [
    activeNode,
    blockedSessionMessage,
    blockedSessionPhase,
    canStartSession,
    connectNonce,
    controllerPeerId,
    performanceProfile,
    supportedBrowser,
    targetAddress,
    targetPeerId,
  ]);

  useEffect(() => {
    if (moduleGenerationRef.current === ANDROID_VIEWPORT_RUNTIME_GENERATION) {
      return;
    }

    // Fast Refresh may replace android-scrcpy-session.ts while preserving page state.
    // Treat that as a stale runtime boundary and rebuild the Android session explicitly.
    moduleGenerationRef.current = ANDROID_VIEWPORT_RUNTIME_GENERATION;
    const staleService = serviceRef.current;
    serviceRef.current = null;
    activePointerIdRef.current = null;
    resetTouchDispatchState();
    setLiveSession(null);
    setSnapshot(createSnapshot("connecting", CONNECTING_MESSAGE));

    const cleanup = rendererCleanupRef.current;
    rendererCleanupRef.current = null;

    void (async () => {
      await cleanup?.().catch(() => undefined);
      await staleService?.close().catch(() => undefined);
      setConnectNonce((value) => value + 1);
    })();
  }, []);

  const { captureScreenshot, rotateDevice, sendKeyCode } = useAndroidDeviceActions({
    handleDeviceOpError,
    onSessionError: setSessionError,
    resolveController: () => liveSession?.scrcpy.controller as AndroidScrcpyControllerLike | undefined,
    resolveDeviceOps: () => getDeviceOps(),
    rotateEnabled,
    rotateState,
    screenshotEnabled,
    screenshotState,
    setDeviceOpNotice,
    setDeviceOpOverrides,
    setDeviceOpStatusNotice,
  });

  const {
    clearKeyboardBridgeValue,
    focusKeyboardBridge,
    handleKeyboardBridgeBeforeInput,
    handleKeyboardBridgeCompositionEnd,
    handleKeyboardBridgeKeyDown,
    handleKeyboardBridgePaste,
    sendTextToDevice,
  } = useAndroidKeyboardBridge({
    controlsEnabled,
    handleDeviceOpError,
    inputRef: keyboardInputRef,
    onSessionError: setSessionError,
    resolveController: () => liveSession?.scrcpy.controller as AndroidScrcpyControllerLike | undefined,
    resolveDeviceOps: () => getDeviceOps(),
    sendKeyCode,
    setDeviceOpNotice,
  });

  const { handlePointerDown, handlePointerMove, handlePointerRelease, handleViewportWheel } = useAndroidPointerBridge({
    canvasRef,
    controlsEnabled,
    focusKeyboardBridge,
    onReconnectRequired: () => {
      void reconnectSession({
        autoRecoveryAttempt: 1,
        message: STREAM_ENDED_MESSAGE,
      });
    },
    onSessionError: setSessionError,
    resolveController: () => {
      const controller = liveSession?.scrcpy.controller as AndroidScrcpyControllerLike | undefined;
      return controller ?? null;
    },
    resetTouchDispatchState,
    setActivePointerId: (pointerId) => {
      activePointerIdRef.current = pointerId;
    },
    shouldReconnectOnControlError: isTransientAndroidControlStreamClosingError,
    touchDispatchStateRef,
    viewportSize,
  });

  async function reconnectSession(options?: {
    allowTakeover?: boolean;
    autoRecoveryAttempt?: number;
    message?: string;
  }) {
    if (reconnectInFlightRef.current) {
      return;
    }
    reconnectInFlightRef.current = true;
    if (!supportedBrowser) {
      const nextSnapshot = createSnapshot("unsupported", UNSUPPORTED_BROWSER_MESSAGE);
      setSnapshot(nextSnapshot);
      reconnectInFlightRef.current = false;
      return;
    }

    resetTouchDispatchState();
    if ((options?.autoRecoveryAttempt ?? 0) > 0) {
      setAutoRecoveryPending(true);
    }
    const service = serviceRef.current;
    if (service == null) {
      nextConnectModeRef.current = options?.allowTakeover === true ? "user-reconnect" : "recover";
      setConnectNonce((value) => value + 1);
      reconnectInFlightRef.current = false;
      return;
    }

    setSnapshot(createSnapshot("reconnecting", options?.message ?? RECONNECTING_MESSAGE));

    const cleanup = rendererCleanupRef.current;
    rendererCleanupRef.current = null;
    await cleanup?.("hard").catch(() => undefined);

    let shouldContinueAutoRecovery = false;
    let autoRecoveryMessage = options?.message ?? STREAM_ENDED_MESSAGE;

    try {
      const nextLiveSession = await service.reconnect({ allowTakeover: options?.allowTakeover === true });
      setSnapshot(service.getSnapshot());
      setLiveSession(nextLiveSession);
      session.refreshPeerTruth();
      resetAutoRecovery();

      const videoStream = await nextLiveSession.scrcpy.videoStream;
      const resolvedVideoStream = videoStream as AndroidScrcpyVideoStreamLike | undefined;
      if (resolvedVideoStream != null) {
        await attachResolvedVideoStream(resolvedVideoStream);
      }
    } catch {
      const nextSnapshot = service.getSnapshot();
      setSnapshot(nextSnapshot);
      setLiveSession(service.getLiveSession());
      shouldContinueAutoRecovery =
        (options?.autoRecoveryAttempt ?? 0) > 0 && nextSnapshot.status === "error" && !options?.allowTakeover;
      autoRecoveryMessage = nextSnapshot.message?.trim() || autoRecoveryMessage;
    } finally {
      reconnectInFlightRef.current = false;
    }

    if (shouldContinueAutoRecovery) {
      scheduleAutoRecovery(autoRecoveryMessage);
    }
  }

  useEffect(() => {
    if (controlsEnabled) {
      return;
    }

    setDeviceOpNotice(null);
    clearKeyboardBridgeValue();
    if (document.activeElement === keyboardInputRef.current) {
      keyboardInputRef.current?.blur();
    }
  }, [controlsEnabled, liveSession?.sessionId]);

  useEffect(() => {
    setDeviceOpNotice(null);
    setDeviceOpOverrides({});
  }, [liveSession?.sessionId]);

  useEffect(() => {
    return () => {
      clearAutoRecoveryTimer();
    };
  }, []);

  const sessionInfoItems: AndroidSessionInfoItem[] = buildSessionInfoItems({
    capabilityTruth: session.capabilityTruth,
    targetPeerId,
    viewportHeight: viewportSize.height,
    viewportWidth: viewportSize.width,
  });
  const sessionDebugItems: AndroidSessionInfoItem[] = buildSessionDebugItems({
    candidateMultiaddrs: session.targetPeer?.multiaddrs,
    connectElapsedMs: snapshot.connectElapsedMs,
    controllerPeerId,
    performanceLabel: performanceTuning.label,
    supportedBrowser,
    targetAddress,
    targetSessionError: session.targetSessionError,
    transportPhase: session.transportPhase,
  });
  const remoteCanvas = (
    <AndroidRemoteCanvas
      canvasRef={canvasRef}
      keyboardInputRef={keyboardInputRef}
      onBeforeInput={handleKeyboardBridgeBeforeInput}
      onCompositionEnd={handleKeyboardBridgeCompositionEnd}
      onKeyDown={handleKeyboardBridgeKeyDown}
      onPaste={handleKeyboardBridgePaste}
      onPointerCancel={(event) => handlePointerRelease(ANDROID_MOTION_ACTION_CANCEL, event, activePointerIdRef.current)}
      onPointerDown={handlePointerDown}
      onPointerMove={(event) => handlePointerMove(event, activePointerIdRef.current)}
      onPointerUp={(event) => handlePointerRelease(ANDROID_MOTION_ACTION_UP, event, activePointerIdRef.current)}
      onWheel={handleViewportWheel}
      shouldRenderCanvas={shouldRenderCanvas}
      viewportHeight={viewportSize.height}
      viewportWidth={viewportSize.width}
    />
  );
  const { clipboardHint, rotateHint, screenshotHint } = buildDeviceOpHints({
    clipboardState,
    controlsEnabled,
    rotateState,
    screenshotState,
  });
  const directExperiment = buildDirectExperimentView({
    candidatePairSummary: session.candidatePairSummary,
    directEvidenceSummary: session.directEvidenceSummary,
    lastError: session.lastError,
    lastResult: session.lastResult,
    runDirectExperiment: session.runDirectExperiment,
    state: session.state,
  });
  return (
    <P2PAndroidViewportStage
      controlsEnabled={controlsEnabled}
      deviceOpNotice={deviceOpNotice}
      directExperiment={directExperiment}
      onBack={() => void sendKeyCode(ANDROID_KEY_CODE_BACK)}
      onHome={() => void sendKeyCode(ANDROID_KEY_CODE_HOME)}
      onPerformanceProfileChange={setPerformanceProfile}
      onReconnect={() => void reconnectSession({ allowTakeover: true })}
      onRecents={() => void sendKeyCode(ANDROID_KEY_CODE_APP_SWITCH)}
      onRotate={() => void rotateDevice()}
      onScreenshot={() => void captureScreenshot()}
      onSendText={async (text) => {
        const sent = await sendTextToDevice(text);
        if (sent) {
          focusKeyboardBridge();
        }
        return sent;
      }}
      performanceMeta={`${performanceTuning.label} · ${formatConnectElapsed(snapshot.connectElapsedMs)}`}
      performanceProfile={performanceProfile}
      reconnectEnabled={!autoRecoveryPending && snapshot.status !== "connecting" && snapshot.status !== "reconnecting"}
      remoteCanvas={remoteCanvas}
      remoteStatus={uiRemoteStatus}
      rotateEnabled={rotateEnabled}
      rotateHint={rotateHint}
      screenshotEnabled={screenshotEnabled}
      screenshotHint={screenshotHint}
      sessionDebugItems={sessionDebugItems}
      sessionInfoItems={sessionInfoItems}
      textActionsEnabled={textActionsEnabled}
      textInputHint={clipboardHint}
      viewportSize={viewportSize}
    />
  );
}
