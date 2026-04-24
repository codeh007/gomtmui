"use client";

import { Badge } from "mtxuilib/ui/badge";
import { Button } from "mtxuilib/ui/button";
import { Card, CardContent, CardHeader } from "mtxuilib/ui/card";
import { Input } from "mtxuilib/ui/input";
import Link from "next/link";
import { DashContent, DashHeaders } from "@/components/dash-layout";
import { useP2PShellState } from "./runtime/p2p-runtime-provider";

export default function P2PPage() {
  const runtime = useP2PShellState();
  const currentPeerId = runtime.currentNode?.peerId?.trim() ?? "";
  const discoveredPeers = runtime.peers.filter((peer) => peer.peerId.trim() !== "" && peer.peerId !== currentPeerId);
  const currentMultiaddrs = runtime.currentNode?.multiaddrs ?? [];

  return (
    <>
      <DashHeaders>
        <h1 className="text-lg font-semibold">P2P</h1>
      </DashHeaders>

      <DashContent className="flex-1 overflow-auto" innerClassName="space-y-4 p-4">
        <Card>
          <CardHeader className="space-y-2">
            <h2 className="text-base font-semibold">当前节点</h2>
            <div className="text-sm text-muted-foreground">当前 shell 节点 peer ID 与可访问地址。</div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-1">
              <div className="text-[11px] font-medium uppercase tracking-[0.16em] text-muted-foreground">Peer ID</div>
              <div className="break-all rounded-md border bg-muted/20 px-3 py-2 font-mono text-sm">
                {currentPeerId === "" ? "未就绪" : currentPeerId}
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
              <Badge variant="outline">{runtime.status}</Badge>
              <span>{currentMultiaddrs.length === 0 ? "暂无地址" : `${currentMultiaddrs.length} 个地址`}</span>
            </div>

            {currentMultiaddrs.length > 0 ? (
              <div className="space-y-2">
                <div className="text-[11px] font-medium uppercase tracking-[0.16em] text-muted-foreground">当前地址</div>
                <div className="space-y-2 rounded-md border bg-muted/20 p-2">
                  {currentMultiaddrs.map((address) => (
                    <div key={address} className="break-all rounded bg-background px-2 py-1 font-mono text-[11px]">
                      {address}
                    </div>
                  ))}
                </div>
              </div>
            ) : null}

            <div className="space-y-2">
              <div className="text-[11px] font-medium uppercase tracking-[0.16em] text-muted-foreground">后端地址</div>
              <form
                className="flex flex-col gap-2 sm:flex-row"
                onSubmit={(event) => {
                  event.preventDefault();
                  void runtime.saveServerUrl();
                }}
              >
                <Input
                  value={runtime.serverUrlInput}
                  onChange={(event) => runtime.setServerUrlInput(event.target.value)}
                  placeholder="gomtm server 公网地址，例如 https://gomtm2.yuepa8.com"
                  spellCheck={false}
                />
                <Button type="submit" className="sm:min-w-28">
                  保存并连接
                </Button>
              </form>
              <div className="text-xs text-muted-foreground">
                {runtime.serverUrl.trim() === "" ? "当前未配置后端地址" : `当前后端地址：${runtime.serverUrl}`}
              </div>
            </div>

            {runtime.errorMessage ? <div className="text-sm text-rose-500">{runtime.errorMessage}</div> : null}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <h2 className="text-base font-semibold">发现节点</h2>
          </CardHeader>
          <CardContent>
            {discoveredPeers.length === 0 ? (
              <div className="rounded-md border border-dashed bg-muted/10 px-4 py-6 text-sm text-muted-foreground">
                暂无发现节点。
              </div>
            ) : (
              <div className="space-y-3">
                {discoveredPeers.map((peer) => {
                  const href = `/dash/p2p/${encodeURIComponent(peer.peerId)}`;
                  return (
                    <div key={peer.peerId} className="rounded-md border bg-muted/10 p-3">
                      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                        <div className="min-w-0 space-y-2">
                          <div className="break-all font-mono text-sm">{peer.peerId}</div>
                          <div className="flex flex-wrap gap-3 text-xs text-muted-foreground">
                            <span>{peer.multiaddrs?.length ?? 0} 个地址</span>
                            <span>{peer.discoveredAt?.trim() ? `发现于 ${peer.discoveredAt}` : "等待发现时间"}</span>
                          </div>
                        </div>

                        <Link
                          href={href}
                          aria-label={`查看节点 ${peer.peerId}`}
                          className="inline-flex h-9 items-center justify-center rounded-md border px-3 text-sm font-medium transition-colors hover:bg-muted"
                        >
                          查看节点
                        </Link>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </DashContent>
    </>
  );
}
