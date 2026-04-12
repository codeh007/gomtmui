"use client";

import { Tabs, TabsList, TabsTrigger } from "mtxuilib/ui/tabs";
import { use, useEffect, useRef, useState } from "react";
import { P2PRemotePageScaffold } from "../p2p-remote-page-shell";
import { getP2PAndroidAvailabilityMeta } from "./android-session-model";
import { P2PAndroidNativeV2WebRtcPanel } from "./p2p-android-native-v2-webrtc-panel";
import { P2PAndroidViewport } from "./p2p-android-viewport";
import { type AndroidRemoteMode, useP2PAndroidPageSession } from "./use-p2p-android-page-session";

function P2PAndroidWorkspace({ peerId }: { peerId: string }) {
  const session = useP2PAndroidPageSession(peerId);
  const [mode, setMode] = useState<AndroidRemoteMode>(session.preferredMode);
  const modeExplicitRef = useRef(false);
  const statusMeta = getP2PAndroidAvailabilityMeta(session.model.availability);
  const surfaceError = session.targetSessionError ?? session.errorMessage;
  const shouldShowBootstrapEntry =
    !session.isConnected && !["loading", "joining", "discovering"].includes(session.status);

  useEffect(() => {
    if (modeExplicitRef.current || mode === session.preferredMode) {
      return;
    }
    setMode(session.preferredMode);
  }, [mode, session.preferredMode]);

  return (
    <P2PRemotePageScaffold
      bootstrapEntry={{
        activeBootstrapAddr: session.activeBootstrapAddr,
        bootstrapInput: session.bootstrapInput,
        canConnect: session.canConnect,
        entryLabel: "Android",
        joiningDetail: "接入后自动进入 Android 控制。",
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
      statusTone={statusMeta.tone}
      surfaceClassName="bg-zinc-950 sm:rounded-none sm:border-0"
      title="Android View"
    >
      {shouldShowBootstrapEntry ? null : (
        <div
          data-testid="android-workspace-layout"
          className="flex h-full min-h-0 flex-col bg-zinc-950 px-3 pb-3 pt-16 sm:px-4 sm:pb-4 sm:pt-20"
        >
          <div className="flex flex-col gap-3 rounded-[28px] border border-white/10 bg-black/50 p-3 shadow-[0_24px_80px_rgba(0,0,0,0.38)] sm:p-4">
            <div className="flex items-center justify-center">
              <Tabs
                value={mode}
                onValueChange={(value) => {
                  modeExplicitRef.current = true;
                  setMode(value === "v2" ? "v2" : "v1");
                }}
                className="w-auto"
              >
                <TabsList className="h-11 rounded-full border border-white/10 bg-zinc-900/90 p-1">
                  <TabsTrigger
                    value="v1"
                    className="rounded-full px-4 text-sm data-[state=active]:bg-white data-[state=active]:text-black"
                  >
                    标准
                  </TabsTrigger>
                  <TabsTrigger
                    value="v2"
                    className="rounded-full px-4 text-sm data-[state=active]:bg-white data-[state=active]:text-black"
                  >
                    原生
                  </TabsTrigger>
                </TabsList>
              </Tabs>
            </div>

            <div className="min-h-0 flex-1 overflow-hidden rounded-[28px] border border-white/10 bg-black/60">
              {mode === "v2" ? (
                <P2PAndroidNativeV2WebRtcPanel session={session} />
              ) : (
                <P2PAndroidViewport session={session} />
              )}
            </div>
          </div>
        </div>
      )}
    </P2PRemotePageScaffold>
  );
}

export function P2PAndroidPageContent({ peerId }: { peerId: string }) {
  return <P2PAndroidWorkspace peerId={peerId} />;
}

export default function P2PAndroidPage({ params }: { params: Promise<{ peer_id: string }> }) {
  const { peer_id } = use(params);

  return <P2PAndroidPageContent peerId={peer_id} />;
}
