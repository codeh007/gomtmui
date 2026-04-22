"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { postServerPeerRemoteCommand } from "@/lib/p2p/server-peer-operator-api";
import { useP2PRuntime } from "../../runtime/p2p-runtime-provider";

function asRecord(value: unknown) {
  return value !== null && typeof value === "object" ? (value as Record<string, unknown>) : null;
}

function toPngDataUrl(value: string) {
  const trimmed = value.trim();
  if (trimmed === "") {
    return null;
  }
  if (trimmed.startsWith("data:image/")) {
    return trimmed;
  }
  return `data:image/png;base64,${trimmed}`;
}

function extractSnapshotDataUrl(value: unknown): string | null {
  if (typeof value === "string") {
    return toPngDataUrl(value);
  }

  const record = asRecord(value);
  if (record == null) {
    return null;
  }

  const directValue =
    typeof record.dataUrl === "string"
      ? record.dataUrl
      : typeof record.data_url === "string"
        ? record.data_url
        : typeof record.imageDataUrl === "string"
          ? record.imageDataUrl
          : typeof record.image_data_url === "string"
            ? record.image_data_url
            : typeof record.imageBase64 === "string"
              ? record.imageBase64
              : typeof record.image_base64 === "string"
                ? record.image_base64
                : typeof record.base64 === "string"
                  ? record.base64
                  : null;
  if (directValue != null) {
    return toPngDataUrl(directValue);
  }

  return extractSnapshotDataUrl(record.data ?? record.result ?? record.payload ?? null);
}

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : String(error);
}

export function useP2PPeerRemotePageSession(peerId: string) {
  const p2pSession = useP2PRuntime();
  const [snapshotDataUrl, setSnapshotDataUrl] = useState<string | null>(null);
  const [remoteErrorMessage, setRemoteErrorMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const requestSeqRef = useRef(0);

  const requestSnapshot = useCallback(async () => {
    const payload = await postServerPeerRemoteCommand({
      command: "screen.snapshot",
      params: { format: "png" },
      peerId,
      serverUrl: p2pSession.serverUrl,
    });
    const nextSnapshotDataUrl = extractSnapshotDataUrl(payload);
    if (nextSnapshotDataUrl == null) {
      throw new Error("未返回截图数据。");
    }
    return nextSnapshotDataUrl;
  }, [p2pSession.serverUrl, peerId]);

  const refreshSnapshot = useCallback(async () => {
    if (!p2pSession.isConnected) {
      setRemoteErrorMessage(null);
      setSnapshotDataUrl(null);
      return;
    }

    const requestSeq = requestSeqRef.current + 1;
    requestSeqRef.current = requestSeq;

    setBusy(true);
    setRemoteErrorMessage(null);

    try {
      const nextSnapshotDataUrl = await requestSnapshot();
      if (requestSeq !== requestSeqRef.current) {
        return;
      }
      setSnapshotDataUrl(nextSnapshotDataUrl);
    } catch (error) {
      if (requestSeq !== requestSeqRef.current) {
        return;
      }
      setSnapshotDataUrl(null);
      setRemoteErrorMessage(getErrorMessage(error));
    } finally {
      if (requestSeq === requestSeqRef.current) {
        setBusy(false);
      }
    }
  }, [p2pSession.isConnected, requestSnapshot]);

  const sendKey = useCallback(
    async (key: "HOME" | "BACK") => {
      if (!p2pSession.isConnected) {
        setRemoteErrorMessage(null);
        return;
      }

      const requestSeq = requestSeqRef.current + 1;
      requestSeqRef.current = requestSeq;

      setBusy(true);
      setRemoteErrorMessage(null);

      try {
        await postServerPeerRemoteCommand({
          command: "input.key",
          params: { key },
          peerId,
          serverUrl: p2pSession.serverUrl,
        });
        const nextSnapshotDataUrl = await requestSnapshot();
        if (requestSeq !== requestSeqRef.current) {
          return;
        }
        setSnapshotDataUrl(nextSnapshotDataUrl);
      } catch (error) {
        if (requestSeq !== requestSeqRef.current) {
          return;
        }
        setSnapshotDataUrl(null);
        setRemoteErrorMessage(getErrorMessage(error));
      } finally {
        if (requestSeq === requestSeqRef.current) {
          setBusy(false);
        }
      }
    },
    [p2pSession.isConnected, p2pSession.serverUrl, peerId, requestSnapshot],
  );

  useEffect(() => {
    requestSeqRef.current += 1;
    if (!p2pSession.isConnected) {
      setRemoteErrorMessage(null);
      setSnapshotDataUrl(null);
      return;
    }

    void refreshSnapshot();
  }, [p2pSession.isConnected, refreshSnapshot]);

  const errorMessage = remoteErrorMessage ?? p2pSession.errorMessage;

  return {
    ...p2pSession,
    busy,
    errorMessage,
    peerId,
    sendBack: () => sendKey("BACK"),
    sendHome: () => sendKey("HOME"),
    snapshotDataUrl,
  };
}
