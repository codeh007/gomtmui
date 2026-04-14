"use client";

import { use } from "react";
import { P2PRemotePageScaffold } from "../p2p-remote-page-shell";
import { getAndroidNativeRemoteV2AvailabilityMeta } from "./android-session-model";
import { P2PAndroidNativeV2WebRtcPanel } from "./p2p-android-native-v2-webrtc-panel";
import { useP2PAndroidPageSession } from "./use-p2p-android-page-session";

function P2PAndroidWorkspace({ peerId }: { peerId: string }) {
  const session = useP2PAndroidPageSession(peerId);
  const statusMeta = getAndroidNativeRemoteV2AvailabilityMeta(
    session.nativeRemoteV2.capability.state,
    session.nativeRemoteV2.capability.reason,
  );
  const surfaceError = session.targetSessionError ?? session.errorMessage;
  const shouldShowBootstrapEntry =
    !session.isConnected && !["loading", "joining", "discovering"].includes(session.status);

  return (
    <P2PRemotePageScaffold
      bootstrapEntry={{
        activeBootstrapAddr: session.activeBootstrapAddr,
        bootstrapInput: session.bootstrapInput,
        canConnect: session.canConnect,
        entryLabel: "Android",
        joiningDetail: "接入后自动进入 Android 原生控制。",
        onBootstrapInputChange: session.setBootstrapInput,
        onConnect: () => {
          void session.connect();
        },
        status: session.status,
        surfaceError,
      }}
      showBootstrapEntry={shouldShowBootstrapEntry}
      contentInnerClassName="h-full p-0"
      showSurfaceStatusBadge={false}
      statusLabel={statusMeta.label}
      statusTone={statusMeta.tone === "success" ? "default" : "secondary"}
      surfaceClassName="bg-zinc-950 sm:rounded-none sm:border-0"
      title="Android View"
    >
      {shouldShowBootstrapEntry ? null : <P2PAndroidNativeV2WebRtcPanel session={session} />}
    </P2PRemotePageScaffold>
  );
}

export default function P2PAndroidPage({ params }: { params: Promise<{ peer_id: string }> }) {
  const { peer_id } = use(params);

  return <P2PAndroidWorkspace peerId={peer_id} />;
}
