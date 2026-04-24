"use client";

import { Home, Undo2 } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "mtxuilib/ui/alert";
import { Button } from "mtxuilib/ui/button";
import { getP2PStatusMeta } from "../../runtime/p2p-runtime-contract";
import { P2PRemotePageScaffold } from "../p2p-remote-page-shell";
import { useP2PPeerRemotePageSession } from "./use-p2p-peer-remote-page-session";

export function P2PPeerRemotePageView({ peerId }: { peerId: string }) {
  const session = useP2PPeerRemotePageSession(peerId);
  const statusMeta = getP2PStatusMeta(session.status);

  return (
    <P2PRemotePageScaffold
      connectionEntry={{
        currentNodeAddrs: session.currentNode?.multiaddrs ?? [],
        entryLabel: "远程控制",
        onBackToP2P: "/dash/p2p",
        status: session.status,
        surfaceError: session.errorMessage,
      }}
      showConnectionEntry={!session.isConnected}
      statusLabel={statusMeta.label}
      statusTone={statusMeta.tone}
        title="远程控制"
      >
      <div className="flex h-full min-h-0 flex-col bg-background">
        <div className="flex flex-wrap items-center gap-2 border-b px-4 py-3">
          <Button variant="outline" size="sm" onClick={() => void session.sendHome()} disabled={session.busy}>
            <Home className="mr-2 size-4" />
            HOME
          </Button>
          <Button variant="outline" size="sm" onClick={() => void session.sendBack()} disabled={session.busy}>
            <Undo2 className="mr-2 size-4" />
            返回
          </Button>
        </div>

        {session.errorMessage ? (
          <div className="px-4 pt-4">
            <Alert variant="destructive">
              <AlertTitle>远控失败</AlertTitle>
              <AlertDescription>{session.errorMessage}</AlertDescription>
            </Alert>
          </div>
        ) : null}

        <div className="flex min-h-0 flex-1 items-center justify-center p-4">
          {session.snapshotDataUrl ? (
            <img
              alt="远控截图"
              className="max-h-full max-w-full rounded-lg border bg-muted object-contain"
              src={session.snapshotDataUrl}
            />
          ) : (
            <div className="rounded-xl border border-dashed px-6 py-10 text-sm text-muted-foreground">等待截图</div>
          )}
        </div>
      </div>
    </P2PRemotePageScaffold>
  );
}
