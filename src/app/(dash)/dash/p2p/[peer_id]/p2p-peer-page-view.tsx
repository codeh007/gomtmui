"use client";

import { RefreshCw } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "mtxuilib/ui/alert";
import { Badge } from "mtxuilib/ui/badge";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "mtxuilib/ui/breadcrumb";
import { Button } from "mtxuilib/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "mtxuilib/ui/card";
import Link from "next/link";
import { DashContent, DashHeaders } from "@/components/dash-layout";
import { getPeerDisplayTitle } from "@/lib/p2p/discovery-contracts";
import { getP2PStatusMeta } from "../runtime/p2p-runtime-contract";
import { useP2PPeerPageSession } from "./use-p2p-peer-page-session";

const PEER_TRUTH_STATUS_LABELS = {
  idle: "待获取",
  loading: "读取中",
  ready: "已就绪",
  error: "失败",
} as const;

function toneForPeerTruth(status: ReturnType<typeof useP2PPeerPageSession>["peerTruthStatus"]) {
  if (status === "ready") {
    return "default" as const;
  }
  if (status === "error") {
    return "destructive" as const;
  }
  return "secondary" as const;
}

function isCanonicalRemoteControlCapability(capability: { name: string }) {
  return capability.name.trim().toLowerCase() === "android.native_remote_v2_webrtc";
}

export function P2PPeerPageView({ peerId }: { peerId: string }) {
  const session = useP2PPeerPageSession(peerId);
  const networkStatusMeta = getP2PStatusMeta(session.status);
  const peerTitle = session.peer == null ? peerId : getPeerDisplayTitle(session.peer);

  return (
    <>
      <DashHeaders>
        <div className="flex min-w-0 flex-col gap-1">
          <Breadcrumb>
            <BreadcrumbList>
              <BreadcrumbItem>
                <BreadcrumbLink href="/dash/p2p">P2P</BreadcrumbLink>
              </BreadcrumbItem>
              <BreadcrumbSeparator />
              <BreadcrumbItem>
                <BreadcrumbPage>节点能力</BreadcrumbPage>
              </BreadcrumbItem>
            </BreadcrumbList>
          </Breadcrumb>
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-lg font-semibold">{peerTitle}</h1>
            <Badge variant={networkStatusMeta.tone}>{networkStatusMeta.label}</Badge>
            <Badge variant={toneForPeerTruth(session.peerTruthStatus)}>
              {PEER_TRUTH_STATUS_LABELS[session.peerTruthStatus]}
            </Badge>
          </div>
        </div>
      </DashHeaders>

      <DashContent className="flex-1 overflow-auto" innerClassName="space-y-4 p-3 sm:p-4">
        <Card>
          <CardHeader className="space-y-3 pb-3">
            <CardTitle className="text-base">目标节点</CardTitle>
            <div className="space-y-2 rounded-lg bg-muted/40 p-3 text-sm text-muted-foreground">
              <div>
                <div className="text-[11px] uppercase tracking-wide">Peer</div>
                <div className="mt-1 break-all font-mono text-foreground">{peerId}</div>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant={networkStatusMeta.tone}>{networkStatusMeta.label}</Badge>
                <Badge variant={toneForPeerTruth(session.peerTruthStatus)}>
                  {PEER_TRUTH_STATUS_LABELS[session.peerTruthStatus]}
                </Badge>
                <span>{session.peer?.discoveredAt?.trim() ? `最近发现 ${session.peer.discoveredAt}` : "等待发现时间"}</span>
              </div>
            </div>
          </CardHeader>

          <CardContent className="flex flex-wrap gap-2 pt-0">
            <Link
              href="/dash/p2p"
              className="inline-flex h-9 items-center justify-center rounded-md border px-3 text-sm font-medium transition-colors hover:bg-muted"
            >
              返回 P2P
            </Link>
            <Button
              variant="outline"
              size="sm"
              onClick={() => session.refreshPeerTruth()}
              disabled={!session.isConnected || session.peerTruthStatus === "loading"}
            >
              <RefreshCw className="mr-2 size-4" />
              刷新能力
            </Button>
          </CardContent>
        </Card>

        {session.errorMessage ? (
          <Alert variant="destructive">
            <AlertTitle>网络连接错误</AlertTitle>
            <AlertDescription>{session.errorMessage}</AlertDescription>
          </Alert>
        ) : null}

        {session.peerTruthErrorMessage ? (
          <Alert variant="destructive">
            <AlertTitle>节点能力失败</AlertTitle>
            <AlertDescription>{session.peerTruthErrorMessage}</AlertDescription>
          </Alert>
        ) : null}

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">节点能力</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 pt-0">
            {!session.isConnected ? (
              <div className="rounded-xl border border-dashed px-4 py-8 text-sm text-muted-foreground">
                请先回到 P2P 主页面连接服务器。
              </div>
            ) : session.capabilities.length === 0 ? (
              <div className="rounded-xl border border-dashed px-4 py-8 text-sm text-muted-foreground">
                当前没有可展示的节点能力。
              </div>
            ) : (
              session.capabilities.map((capability) => (
                <article key={capability.name} className="rounded-xl border px-4 py-4">
                  <div className="flex flex-wrap items-center gap-2">
                    <h2 className="font-mono text-sm font-medium">{capability.name}</h2>
                    <Badge variant={capability.state?.trim().toLowerCase() === "available" ? "default" : "secondary"}>
                      {capability.state || "unknown"}
                    </Badge>
                    {session.canOpenAndroid && isCanonicalRemoteControlCapability(capability) ? (
                      <Link
                        href={`/dash/p2p/${peerId}/remote`}
                        className="inline-flex h-8 items-center justify-center rounded-md border px-3 text-sm font-medium transition-colors hover:bg-muted"
                      >
                        打开远控
                      </Link>
                    ) : null}
                  </div>
                  {capability.reason ? <p className="mt-2 text-sm text-muted-foreground">原因：{capability.reason}</p> : null}
                </article>
              ))
            )}
          </CardContent>
        </Card>

        <details className="rounded-xl border bg-muted/10 px-4 py-3 text-sm">
          <summary className="cursor-pointer font-medium">诊断信息</summary>
          <pre className="mt-3 overflow-x-auto rounded-lg bg-background p-3 text-xs text-muted-foreground">
            {JSON.stringify(session.diagnostics, null, 2)}
          </pre>
        </details>
      </DashContent>
    </>
  );
}
