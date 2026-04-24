"use client";

import { P2PRemotePageScaffold } from "../p2p-remote-page-shell";
import { P2PKasmViewport } from "./p2p-kasm-viewport";
import { useP2PVncPageSession } from "./use-p2p-vnc-page-session";
import { getVncAvailabilityMeta } from "./vnc-session-model";

export function P2PVncPageView({ peerId }: { peerId: string }) {
  const session = useP2PVncPageSession(peerId);
  const statusMeta = getVncAvailabilityMeta(session.model.availability);

  return (
    <P2PRemotePageScaffold
      connectionEntry={{
        currentNodeAddrs: session.currentNode?.multiaddrs ?? [],
        entryLabel: "VNC",
        onBackToP2P: "/dash/p2p",
        status: session.status,
        surfaceError: session.targetSessionError,
      }}
      showConnectionEntry={!session.isConnected}
      statusLabel={statusMeta.label}
      statusTone={statusMeta.tone}
      title="VNC View"
    >
      <P2PKasmViewport />
    </P2PRemotePageScaffold>
  );
}
