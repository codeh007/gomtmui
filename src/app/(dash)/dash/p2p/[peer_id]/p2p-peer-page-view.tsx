"use client";

import { Cpu, RefreshCw, Router, Smartphone, Waypoints } from "lucide-react";
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
import { getP2PStatusMeta } from "../use-p2p-session";
import { useP2PPeerPageSession } from "./use-p2p-peer-page-session";

const PEER_TRUTH_STATUS_LABELS = {
  idle: "待获取",
  loading: "读取中",
  ready: "已就绪",
  error: "失败",
} as const;

function PeerStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border px-4 py-3">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="mt-1 break-all font-medium text-sm">{value}</div>
    </div>
  );
}

function toneForPeerTruth(status: ReturnType<typeof useP2PPeerPageSession>["peerTruthStatus"]) {
  if (status === "ready") {
    return "default" as const;
  }
  if (status === "error") {
    return "destructive" as const;
  }
  return "secondary" as const;
}

export function P2PPeerPageView({ peerId }: { peerId: string }) {
  const session = useP2PPeerPageSession(peerId);
  const networkStatusMeta = getP2PStatusMeta(session.status);
  const remoteControl = session.capabilityTruth?.remoteControl;
  const peerTitle = session.targetPeer == null ? "P2P 节点详情" : getPeerDisplayTitle(session.targetPeer);

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
                <BreadcrumbPage>节点详情</BreadcrumbPage>
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
        <div className="grid min-h-full gap-4 xl:grid-cols-[320px_minmax(0,1fr)]">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-base">
                <Router className="size-4" />
                网络
              </CardTitle>
              <div className="rounded-lg bg-muted/40 p-3 text-xs text-muted-foreground">
                <div className="font-medium text-foreground">Peer</div>
                <div className="mt-1 break-all font-mono">{peerId}</div>
              </div>
            </CardHeader>

            <CardContent className="space-y-4 pt-0">
              <div className="rounded-lg border bg-muted/20 px-3 py-3 text-xs text-muted-foreground">
                节点详情页不再支持手工输入连接地址；请回到 P2P 主页面连接服务器，会话建立后这里会自动复用当前连接。
              </div>

              {session.activeConnectionAddr ? (
                <div className="rounded-lg border bg-muted/20 px-3 py-2 text-xs text-muted-foreground">
                  <div className="text-[11px] uppercase tracking-wide">当前连接入口</div>
                  <div className="mt-1 break-all font-mono">{session.activeConnectionAddr}</div>
                </div>
              ) : null}
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

              <div className="flex flex-wrap gap-2 pt-1">
                <Button asChild variant="outline" size="sm">
                  <Link href="/dash/p2p">返回</Link>
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => session.refreshPeerTruth()}
                  disabled={!session.isConnected || session.targetPeer == null || session.peerTruthStatus === "loading"}
                >
                  <RefreshCw className="mr-2 size-4" />
                  刷新
                </Button>
              </div>
            </CardContent>
          </Card>

          <div className="space-y-4">
            {session.targetPeer == null ? (
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">等待节点</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="rounded-xl border border-dashed px-4 py-10 text-sm text-muted-foreground">
                    {session.isConnected ? `尚未发现 ${peerId}` : "请先回到 P2P 主页面连接服务器。"}
                  </div>
                </CardContent>
              </Card>
            ) : (
              <>
                <Card>
                  <CardHeader className="pb-3">
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                      <CardTitle className="flex items-center gap-2 text-base">
                        <Cpu className="size-4" />
                        概览
                      </CardTitle>
                      <div className="flex flex-wrap gap-2">
                        {session.canOpenAndroid ? (
                          <Button asChild size="sm" variant="secondary">
                            <Link href={`/dash/p2p/${encodeURIComponent(peerId)}/android`}>
                              <Smartphone className="mr-2 size-4" />
                              Android
                            </Link>
                          </Button>
                        ) : null}

                        {!session.canOpenAndroid ? (
                          <Badge variant="outline">无直达入口</Badge>
                        ) : null}
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-4 pt-0">
                    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                      <PeerStat label="Android" value={session.canOpenAndroid ? "可用" : "无"} />
                      <PeerStat label="最近发现" value={session.targetPeer.lastDiscoveredAt || "未知"} />
                    </div>

                    <div className="space-y-2">
                      <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">协议</div>
                      <div className="flex flex-wrap gap-2">
                        {session.featureLabels.length > 0 ? (
                          session.featureLabels.map((label) => (
                            <Badge key={label} variant="secondary" className="uppercase">
                              {label === "android" ? "Android" : label}
                            </Badge>
                          ))
                        ) : (
                          <Badge variant="outline">未声明高级协议</Badge>
                        )}
                      </div>
                    </div>

                    {remoteControl ? (
                      <div className="space-y-2">
                        <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Android</div>
                        <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-4">
                          <PeerStat label="platform" value={remoteControl.platform || "unknown"} />
                          <PeerStat label="controller" value={remoteControl.session.controllerState || "unknown"} />
                          <PeerStat
                            label="native_remote_v2_webrtc"
                            value={remoteControl.capabilities.nativeRemoteV2WebRTC?.state || "unknown"}
                          />
                          {remoteControl.session.activeControllerPeerId ? (
                            <div className="rounded-xl border px-4 py-3 text-xs md:col-span-2 xl:col-span-4">
                              <div className="text-muted-foreground">active_controller_peer_id</div>
                              <div className="mt-1 break-all font-mono text-xs font-medium">
                                {remoteControl.session.activeControllerPeerId}
                              </div>
                            </div>
                          ) : null}
                        </div>
                      </div>
                    ) : null}
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="flex items-center gap-2 text-base">
                      <Waypoints className="size-4" />
                      地址
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="pt-0">
                    {session.visibleMultiaddrs.length === 0 ? (
                      <div className="rounded-xl border border-dashed px-4 py-8 text-sm text-muted-foreground">
                        当前没有可用地址。
                      </div>
                    ) : (
                      <div className="space-y-3">
                        {session.visibleMultiaddrs.map((value) => (
                          <div key={value} className="rounded-xl border px-4 py-3">
                            <div className="break-all font-mono text-xs text-muted-foreground">{value}</div>
                          </div>
                        ))}
                      </div>
                    )}
                  </CardContent>
                </Card>
              </>
            )}
          </div>
        </div>
      </DashContent>
    </>
  );
}
