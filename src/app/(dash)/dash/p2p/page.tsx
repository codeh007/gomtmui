"use client";

import {
  AlertTriangle,
  ChevronDown,
  Cpu,
  Info,
  LoaderCircle,
  Monitor,
  MoreHorizontal,
  Smartphone,
  Waypoints,
  Wifi,
  WifiOff,
} from "lucide-react";
import { Badge } from "mtxuilib/ui/badge";
import { Button } from "mtxuilib/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "mtxuilib/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "mtxuilib/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "mtxuilib/ui/dropdown-menu";
import { Input } from "mtxuilib/ui/input";
import { Item, ItemActions, ItemContent, ItemGroup, ItemMedia, ItemTitle } from "mtxuilib/ui/item";
import { Popover, PopoverContent, PopoverTrigger } from "mtxuilib/ui/popover";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { DashContent, DashHeaders } from "@/components/dash-layout";
import {
  canOpenAndroidView,
  listPeerFeatureLabels,
  type PeerCapabilityTruth,
  supportsAndroidRemoteControl,
  supportsVncView,
} from "@/lib/p2p/discovery-contracts";
import {
  getBootstrapPathLabel,
  getP2PStatusMeta,
  getPreferredPeerBootstrapPathLabel,
  type P2PStatus,
  useP2PSession,
} from "./use-p2p-session";

function extractBootstrapPeerId(address: string) {
  const trimmed = address.trim();
  if (trimmed === "") {
    return "";
  }
  const marker = "/p2p/";
  const index = trimmed.lastIndexOf(marker);
  if (index === -1) {
    return "";
  }
  return trimmed.slice(index + marker.length).trim();
}

function getNetworkStatusDisplay(status: P2PStatus) {
  if (status === "peer_candidates_ready" || status === "discovering") {
    return {
      icon: Wifi,
      iconClassName: "text-emerald-600 dark:text-emerald-400",
    };
  }

  if (status === "needs-bootstrap") {
    return {
      icon: WifiOff,
      iconClassName: "text-amber-500",
    };
  }

  if (status === "joining" || status === "loading") {
    return {
      icon: LoaderCircle,
      iconClassName: "animate-spin text-amber-500",
    };
  }

  return {
    icon: AlertTriangle,
    iconClassName: status === "error" ? "text-rose-500" : "text-amber-500",
  };
}

function getPeerKindIcon(truth: PeerCapabilityTruth | null | undefined) {
  if (supportsAndroidRemoteControl(truth?.remoteControl)) {
    return Smartphone;
  }
  if (supportsVncView(truth?.vnc)) {
    return Monitor;
  }
  return Cpu;
}

function getPeerShortId(peerId: string | null | undefined) {
  const normalizedPeerId = peerId?.trim() ?? "";
  if (normalizedPeerId === "") {
    return "未知";
  }
  return normalizedPeerId.length <= 8 ? normalizedPeerId : normalizedPeerId.slice(-8);
}

function formatPeerFeatureLabel(label: string) {
  if (label === "android") {
    return "Android";
  }
  if (label === "vnc") {
    return "VNC";
  }
  return label;
}

function getPreferredPeerAction(peerId: string, truth: PeerCapabilityTruth | null | undefined) {
  const encodedPeerId = encodeURIComponent(peerId);
  if (canOpenAndroidView(truth?.remoteControl)) {
    return {
      href: `/dash/p2p/${encodedPeerId}/android`,
      label: "Android",
      variant: "secondary" as const,
    };
  }

  if (supportsVncView(truth?.vnc)) {
    return {
      href: `/dash/p2p/${encodedPeerId}/vnc`,
      label: "VNC",
      variant: "default" as const,
    };
  }

  return {
    href: `/dash/p2p/${encodedPeerId}`,
    label: "详情",
    variant: "outline" as const,
  };
}

function getPeerSecondaryActions(peerId: string, truth: PeerCapabilityTruth | null | undefined) {
  const encodedPeerId = encodeURIComponent(peerId);
  const preferredHref = getPreferredPeerAction(peerId, truth).href;
  const allActions = [
    { href: `/dash/p2p/${encodedPeerId}`, label: "详情" },
    ...(supportsVncView(truth?.vnc) ? [{ href: `/dash/p2p/${encodedPeerId}/vnc`, label: "VNC" }] : []),
    ...(canOpenAndroidView(truth?.remoteControl)
      ? [{ href: `/dash/p2p/${encodedPeerId}/android`, label: "Android" }]
      : []),
  ];

  return allActions.filter((action) => action.href !== preferredHref);
}

export default function P2PPage() {
  const session = useP2PSession();
  const router = useRouter();
  const statusMeta = getP2PStatusMeta(session.status);
  const networkStatusDisplay = getNetworkStatusDisplay(session.status);
  const NetworkStatusIcon = networkStatusDisplay.icon;
  const activeBootstrapPeerId = extractBootstrapPeerId(session.activeBootstrapAddr);

  return (
    <>
      <DashHeaders>
        <h1 className="text-lg font-semibold">P2P</h1>
      </DashHeaders>

      <DashContent className="flex-1 overflow-auto" innerClassName="space-y-3 p-3 sm:space-y-4 sm:p-4">
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-2">
                <Waypoints className="size-4 text-muted-foreground" />
                <CardTitle className="text-base">节点</CardTitle>
              </div>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-9 gap-2 rounded-full px-3"
                    aria-label={`网络状态：${statusMeta.label}`}
                  >
                    <NetworkStatusIcon className={`size-4 ${networkStatusDisplay.iconClassName}`} />
                    <ChevronDown className="size-4 text-muted-foreground" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent align="end" className="w-[min(24rem,calc(100vw-2rem))] space-y-3 p-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="space-y-1">
                      <div className="text-sm font-medium">网络</div>
                      <div className="text-xs text-muted-foreground">{statusMeta.label}</div>
                    </div>
                    <div className="inline-flex items-center gap-2 rounded-full border bg-muted/20 px-2.5 py-1 text-[11px] text-muted-foreground">
                      <NetworkStatusIcon className={`size-3.5 ${networkStatusDisplay.iconClassName}`} />
                      <span>{getBootstrapPathLabel(session.activeBootstrapAddr)}</span>
                    </div>
                  </div>

                  <div className="space-y-1">
                    <div className="text-[11px] font-medium uppercase tracking-[0.16em] text-muted-foreground">
                      当前地址
                    </div>
                    <div className="break-all rounded-md border bg-muted/20 px-3 py-2 font-mono text-[11px] text-muted-foreground">
                      {session.activeBootstrapAddr.trim() === "" ? "未连接" : session.activeBootstrapAddr}
                    </div>
                  </div>

                  <form
                    className="space-y-2"
                    onSubmit={(event) => {
                      event.preventDefault();
                      void session.connect();
                    }}
                  >
                    <Input
                      value={session.bootstrapInput}
                      onChange={(event) => session.setBootstrapInput(event.target.value)}
                      placeholder="auto_bootstrap multiaddr"
                      spellCheck={false}
                    />
                    <div className="flex justify-end">
                      <Button type="submit" size="sm" disabled={!session.canConnect} className="min-w-24">
                        {session.isConnected ? "重新连接" : "连接"}
                      </Button>
                    </div>
                  </form>

                  {session.errorMessage ? <div className="text-xs text-rose-500">{session.errorMessage}</div> : null}
                </PopoverContent>
              </Popover>
            </div>
          </CardHeader>
          <CardContent className="pt-0">
            {session.peerCandidates.length === 0 ? (
              <div className="rounded-xl border border-dashed bg-muted/10 px-4 py-8 text-sm text-muted-foreground">
                {session.isConnected ? "已接入 relay，等待节点。" : "先连接 relay。"}
              </div>
            ) : (
              <ItemGroup>
                {session.peerCandidates.map((peer) => {
                  const truth = session.getResolvedPeerTruth(peer.peerId);
                  const featureLabels = listPeerFeatureLabels(truth?.vnc, truth?.remoteControl);
                  const preferredAction = getPreferredPeerAction(peer.peerId, truth);
                  const secondaryActions = getPeerSecondaryActions(peer.peerId, truth);
                  const PeerKindIcon = getPeerKindIcon(truth);
                  const peerShortId = getPeerShortId(peer.peerId);

                  return (
                    <Item key={peer.peerId}>
                      <ItemMedia className="pt-1">
                        <div
                          className={`rounded-full border p-2 ${peer.peerId === activeBootstrapPeerId ? "border-emerald-200 bg-emerald-50 text-emerald-600 dark:border-emerald-900/60 dark:bg-emerald-950/40 dark:text-emerald-300" : "bg-muted/20 text-muted-foreground"}`}
                        >
                          <PeerKindIcon className="size-4" />
                        </div>
                      </ItemMedia>

                      <ItemContent>
                        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                          <div className="min-w-0 flex-1 space-y-2">
                            <div className="flex flex-wrap items-center gap-2">
                              <ItemTitle className="text-base font-semibold tracking-tight">…{peerShortId}</ItemTitle>
                              {peer.peerId === activeBootstrapPeerId ? (
                                <Badge variant="outline" className="text-[10px] uppercase text-muted-foreground">
                                  Relay
                                </Badge>
                              ) : null}
                              <Badge variant="outline" className="text-[10px] uppercase text-muted-foreground">
                                {getPreferredPeerBootstrapPathLabel(
                                  peer.multiaddrs,
                                  truth?.bootstrapConnectionPath?.path,
                                )}
                              </Badge>
                              {featureLabels.length > 0 ? (
                                featureLabels.map((label) => (
                                  <Badge key={label} variant="secondary" className="text-[10px] uppercase">
                                    {formatPeerFeatureLabel(label)}
                                  </Badge>
                                ))
                              ) : (
                                <Badge variant="outline" className="text-[10px] uppercase text-muted-foreground">
                                  基础
                                </Badge>
                              )}
                            </div>

                            <div className="flex flex-wrap items-center gap-3 text-[11px] text-muted-foreground">
                              <div className="inline-flex items-center gap-1">
                                <Waypoints className="size-3" />
                                <span>{`${peer.multiaddrs.length} 地址`}</span>
                              </div>
                            </div>
                          </div>

                          <ItemActions className="flex w-full items-center justify-end gap-1 sm:w-auto">
                            <Button asChild size="sm" variant={preferredAction.variant} className="h-8 min-w-20">
                              <Link href={preferredAction.href}>{preferredAction.label}</Link>
                            </Button>

                            <Dialog>
                              <DialogTrigger asChild>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-8 w-8"
                                  aria-label={`查看节点 ${peerShortId} 详情`}
                                >
                                  <Info className="size-4" />
                                </Button>
                              </DialogTrigger>
                              <DialogContent className="max-w-[calc(100vw-2rem)] sm:max-w-[560px]">
                                <DialogHeader>
                                  <DialogTitle>节点 …{peerShortId}</DialogTitle>
                                  <DialogDescription className="sr-only">
                                    查看节点详细信息与可用入口。
                                  </DialogDescription>
                                </DialogHeader>

                                <div className="space-y-4 text-sm">
                                  <div className="flex flex-wrap gap-1">
                                    {peer.peerId === activeBootstrapPeerId ? (
                                      <Badge variant="outline" className="text-[10px] uppercase text-muted-foreground">
                                        Relay
                                      </Badge>
                                    ) : null}
                                    <Badge variant="outline" className="text-[10px] uppercase text-muted-foreground">
                                      {getPreferredPeerBootstrapPathLabel(
                                        peer.multiaddrs,
                                        truth?.bootstrapConnectionPath?.path,
                                      )}
                                    </Badge>
                                    {featureLabels.length > 0 ? (
                                      featureLabels.map((label) => (
                                        <Badge
                                          key={`detail-${label}`}
                                          variant="secondary"
                                          className="text-[10px] uppercase"
                                        >
                                          {formatPeerFeatureLabel(label)}
                                        </Badge>
                                      ))
                                    ) : (
                                      <Badge variant="outline" className="text-[10px] uppercase text-muted-foreground">
                                        基础
                                      </Badge>
                                    )}
                                  </div>

                                  <div className="grid gap-3 sm:grid-cols-2">
                                    <div className="space-y-1">
                                      <div className="text-[11px] font-medium uppercase tracking-[0.16em] text-muted-foreground">
                                        Peer ID
                                      </div>
                                      <div className="break-all rounded-md border bg-muted/20 px-3 py-2 font-mono text-xs">
                                        {peer.peerId}
                                      </div>
                                    </div>

                                    <div className="space-y-1">
                                      <div className="text-[11px] font-medium uppercase tracking-[0.16em] text-muted-foreground">
                                        地址数
                                      </div>
                                      <div className="rounded-md border bg-muted/20 px-3 py-2 text-xs text-muted-foreground">
                                        {peer.multiaddrs.length}
                                      </div>
                                    </div>
                                  </div>

                                  <div className="space-y-2">
                                    <div className="text-[11px] font-medium uppercase tracking-[0.16em] text-muted-foreground">
                                      Multiaddr
                                    </div>
                                    <div className="max-h-48 space-y-2 overflow-auto rounded-md border bg-muted/20 p-2">
                                      {peer.multiaddrs.map((address) => (
                                        <div
                                          key={address}
                                          className="break-all rounded bg-background px-2 py-1 font-mono text-[11px]"
                                        >
                                          {address}
                                        </div>
                                      ))}
                                    </div>
                                  </div>

                                  <div className="flex flex-wrap gap-2">
                                    <Button asChild size="sm" variant={preferredAction.variant}>
                                      <Link href={preferredAction.href}>{preferredAction.label}</Link>
                                    </Button>
                                    {secondaryActions.map((action) => (
                                      <Button key={action.href} asChild size="sm" variant="outline">
                                        <Link href={action.href}>{action.label}</Link>
                                      </Button>
                                    ))}
                                  </div>
                                </div>
                              </DialogContent>
                            </Dialog>

                            {secondaryActions.length > 0 ? (
                              <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                  <Button variant="ghost" size="icon" className="h-8 w-8" aria-label="更多操作">
                                    <MoreHorizontal className="size-4" />
                                  </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end">
                                  {secondaryActions.map((action) => (
                                    <DropdownMenuItem
                                      key={action.href}
                                      onSelect={() => {
                                        router.push(action.href);
                                      }}
                                    >
                                      {action.label}
                                    </DropdownMenuItem>
                                  ))}
                                </DropdownMenuContent>
                              </DropdownMenu>
                            ) : null}
                          </ItemActions>
                        </div>
                      </ItemContent>
                    </Item>
                  );
                })}
              </ItemGroup>
            )}
          </CardContent>
        </Card>
      </DashContent>
    </>
  );
}
