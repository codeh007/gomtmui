"use client";

import { use } from "react";
import { Badge } from "mtxuilib/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "mtxuilib/ui/card";
import { useP2PAndroidPageSession } from "./use-p2p-android-page-session";

function P2PAndroidWorkspace({ peerId }: { peerId: string }) {
  const session = useP2PAndroidPageSession(peerId);
  const capability = session.capability;

  return (
    <div className="p-4">
      <Card>
        <CardHeader>
          <CardTitle>Android 节点</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          <div>Peer ID: {session.peerId}</div>
          <div>Target Address: {session.targetAddress ?? "<none>"}</div>
          <Badge variant="outline">{capability.state ?? "unknown"}</Badge>
          <div>{capability.reason ?? "no detail"}</div>
        </CardContent>
      </Card>
    </div>
  );
}

export default function P2PAndroidPage({ params }: { params: Promise<{ peer_id: string }> }) {
  const { peer_id } = use(params);

  return <P2PAndroidWorkspace peerId={decodeURIComponent(peer_id)} />;
}
