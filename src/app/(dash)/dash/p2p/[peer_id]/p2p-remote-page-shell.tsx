"use client";

import { ChevronLeft } from "lucide-react";
import { cn } from "mtxuilib/lib/utils";
import { Alert, AlertDescription, AlertTitle } from "mtxuilib/ui/alert";
import { Badge } from "mtxuilib/ui/badge";
import { Button } from "mtxuilib/ui/button";
import Link from "next/link";
import type { ReactNode } from "react";
import { DashContent } from "@/components/dash-layout";
import type { P2PStatus } from "../use-p2p-session";

type StatusTone = "default" | "secondary" | "destructive";

type P2PConnectionEntryMeta = {
  title: string;
  detail: string;
};

export function getP2PConnectionEntryMeta(status: P2PStatus, joiningDetail: string): P2PConnectionEntryMeta {
  if (status === "loading") {
    return {
      title: "准备浏览器节点",
      detail: "正在初始化 P2P 能力。",
    };
  }

  if (status === "joining") {
    return {
      title: "接入中",
      detail: joiningDetail,
    };
  }

  if (status === "error") {
    return {
      title: "等待服务器恢复",
      detail: "当前节点连接依赖主页面已建立的服务器会话，请先返回 P2P 页面检查后端地址与连接状态。",
    };
  }

  return {
    title: "等待服务器连接",
    detail: "当前节点页面不再支持手工输入连接地址；请先在 P2P 主页面连接服务器。",
  };
}


type P2PConnectionEntryCardProps = {
  activeConnectionAddr: string;
  entryLabel: string;
  joiningDetail: string;
  onBackToP2P: string;
  status: P2PStatus;
  surfaceError: string | null;
};

export function P2PConnectionEntryCard({
  activeConnectionAddr,
  entryLabel,
  joiningDetail,
  onBackToP2P,
  status,
  surfaceError,
}: P2PConnectionEntryCardProps) {
  const entryMeta = getP2PConnectionEntryMeta(status, joiningDetail);

  return (
    <div className="mx-auto flex min-h-full w-full max-w-3xl flex-col justify-center gap-4 px-3 py-4 sm:px-0 sm:py-0">
      <div className="rounded-2xl border bg-background/95 px-4 py-4 shadow-sm sm:px-5 sm:py-5">
        <div className="space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="outline" className="rounded-full text-[11px] uppercase text-muted-foreground">
              {entryLabel}
            </Badge>
            <div className="text-base font-semibold tracking-tight">{entryMeta.title}</div>
          </div>
          <div className="text-xs text-muted-foreground">{entryMeta.detail}</div>
        </div>

        <div className="mt-4 flex flex-col gap-3 sm:flex-row">
          <Button asChild className="sm:min-w-40">
            <Link href={onBackToP2P}>返回 P2P 主页面连接服务器</Link>
          </Button>
        </div>

        {activeConnectionAddr ? (
          <div className="mt-3 rounded-lg border bg-muted/20 px-3 py-2 text-xs text-muted-foreground">
            <div className="text-[11px] uppercase tracking-wide">当前连接入口</div>
            <div className="mt-1 break-all font-mono">{activeConnectionAddr}</div>
          </div>
        ) : null}
        {surfaceError ? (
          <Alert variant="destructive" className="mt-3">
            <AlertTitle>连接失败</AlertTitle>
            <AlertDescription>{surfaceError}</AlertDescription>
          </Alert>
        ) : null}
      </div>
    </div>
  );
}

export function P2PRemotePageHeader({
  statusLabel,
  statusTone,
  title,
}: {
  statusLabel: string;
  statusTone: StatusTone;
  title: string;
}) {
  return (
    <header className="sticky top-0 z-10 border-b border-border/40 bg-background/95 px-3 py-2.5 backdrop-blur supports-backdrop-filter:bg-background/60 [padding-left:calc(0.75rem+env(safe-area-inset-left))] [padding-right:calc(0.75rem+env(safe-area-inset-right))] [padding-top:calc(0.625rem+env(safe-area-inset-top))] sm:px-4 sm:py-3 sm:[padding-top:0.75rem]">
      <div className="flex min-w-0 items-center justify-between gap-3">
        <div className="min-w-0 flex flex-1 items-center gap-2">
          <Button asChild variant="ghost" size="sm" className="shrink-0">
            <Link href="/dash/p2p">
              <ChevronLeft className="mr-1 size-4" />
              返回 P2P
            </Link>
          </Button>
          <h1 className="truncate text-base font-semibold sm:text-lg">{title}</h1>
          <Badge variant={statusTone}>{statusLabel}</Badge>
        </div>
      </div>
    </header>
  );
}

export function P2PRemoteSurfaceShell({
  children,
  surfaceClassName,
  showStatusBadge = true,
  statusLabel,
  statusTone,
  title,
}: {
  children: ReactNode;
  surfaceClassName?: string;
  showStatusBadge?: boolean;
  statusLabel: string;
  statusTone: StatusTone;
  title: string;
}) {
  return (
    <div className="flex h-full min-h-0 flex-col">
      <div
        className={cn("relative flex flex-1 overflow-hidden bg-background sm:rounded-2xl sm:border", surfaceClassName)}
      >
        <div className="pointer-events-none absolute [left:calc(0.75rem+env(safe-area-inset-left))] [right:calc(0.75rem+env(safe-area-inset-right))] [top:calc(0.75rem+env(safe-area-inset-top))] z-10 flex items-start justify-between sm:left-6 sm:right-6 sm:top-6">
          <Button
            asChild
            variant="secondary"
            size="icon"
            className="pointer-events-auto size-9 rounded-full border border-border/60 bg-background/85 shadow-sm backdrop-blur-sm"
          >
            <Link href="/dash/p2p" aria-label="返回 P2P">
              <ChevronLeft className="size-4" />
            </Link>
          </Button>
          {showStatusBadge ? (
            <Badge
              variant={statusTone}
              className="rounded-full border border-border/60 bg-background/85 px-2.5 py-1 shadow-sm backdrop-blur-sm"
            >
              {statusLabel}
            </Badge>
          ) : null}
          <h1 className="sr-only">{title}</h1>
        </div>
        {children}
      </div>
    </div>
  );
}

export function P2PRemotePageScaffold({
  connectionEntry,
  children,
  contentInnerClassName,
  showSurfaceStatusBadge = true,
  showConnectionEntry,
  statusLabel,
  statusTone,
  surfaceClassName,
  title,
}: {
  connectionEntry: P2PConnectionEntryCardProps;
  children: ReactNode;
  contentInnerClassName?: string;
  showSurfaceStatusBadge?: boolean;
  showConnectionEntry: boolean;
  statusLabel: string;
  statusTone: StatusTone;
  surfaceClassName?: string;
  title: string;
}) {
  return (
    <>
      {showConnectionEntry ? (
        <P2PRemotePageHeader title={title} statusLabel={statusLabel} statusTone={statusTone} />
      ) : null}

      <DashContent
        className={showConnectionEntry ? "flex-1 overflow-auto" : "flex-1 overflow-hidden"}
        innerClassName={showConnectionEntry ? "p-0 sm:p-3" : (contentInnerClassName ?? "h-full p-0 sm:p-3")}
      >
        {showConnectionEntry ? (
          <P2PConnectionEntryCard {...connectionEntry} />
        ) : (
          <P2PRemoteSurfaceShell
            surfaceClassName={surfaceClassName}
            title={title}
            statusLabel={statusLabel}
            statusTone={statusTone}
            showStatusBadge={showSurfaceStatusBadge}
          >
            {children}
          </P2PRemoteSurfaceShell>
        )}
      </DashContent>
    </>
  );
}
