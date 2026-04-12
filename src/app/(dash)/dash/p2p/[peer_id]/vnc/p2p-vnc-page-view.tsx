"use client";

import { P2PRemotePageScaffold } from "../p2p-remote-page-shell";
import { P2PKasmViewport } from "./p2p-kasm-viewport";
import { useP2PVncPageSession } from "./use-p2p-vnc-page-session";
import { getP2PVncAvailabilityMeta } from "./vnc-session-model";

export function P2PVncPageView({ peerId }: { peerId: string }) {
  const session = useP2PVncPageSession(peerId);
  const statusMeta = getP2PVncAvailabilityMeta(session.model.availability);
  const surfaceError =
    session.model.availability === "permission_denied" ? null : (session.targetSessionError ?? session.errorMessage);

  return (
    <P2PRemotePageScaffold
      bootstrapEntry={{
        activeBootstrapAddr: session.activeBootstrapAddr,
        bootstrapInput: session.bootstrapInput,
        canConnect: session.canConnect,
        entryLabel: "VNC",
        joiningDetail: "接入后自动进入桌面。",
        onBootstrapInputChange: session.setBootstrapInput,
        onConnect: () => {
          void session.connect();
        },
        status: session.status,
        surfaceError,
      }}
      showBootstrapEntry={!session.isConnected}
      statusLabel={statusMeta.label}
      statusTone={statusMeta.tone}
      title="VNC View"
    >
      <P2PKasmViewport session={session} />
    </P2PRemotePageScaffold>
  );
}
