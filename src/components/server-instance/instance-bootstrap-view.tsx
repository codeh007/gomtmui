"use client";

import { CheckCircle2, CircleDashed, Globe, Loader2, Server, TerminalSquare } from "lucide-react";
import { getRelativeTimeStringCN } from "mtxuilib/lib/utils";
import { Button } from "mtxuilib/ui/button";
import { useServerInstanceDetail } from "@/components/server-instance/hooks";
import { InstanceWindowsManualBootstrapView } from "@/components/server-instance/instance-windows-manual-bootstrap-view";
import {
  getServerAccessUrl,
  getServerStatusCopy,
  getServerStatusReasonDisplay,
  getServerStatusSource,
} from "@/components/server-instance/status-contract";

interface InstanceBootstrapViewProps {
  instanceID: string;
  onSuccess?: () => void;
  onClose?: () => void;
}

export function InstanceBootstrapView({ instanceID, onSuccess, onClose }: InstanceBootstrapViewProps) {
  const { data: instance, isLoading } = useServerInstanceDetail(instanceID);

  if (isLoading && !instance) {
    return (
      <div className="flex flex-col items-center justify-center space-y-4 p-12">
        <Loader2 className="size-8 animate-spin text-primary/50" />
        <p className="text-sm text-primary/70">加载实例状态...</p>
      </div>
    );
  }

  if (!instance) {
    return <div className="flex flex-col items-center justify-center p-12 text-destructive">未能找到该实例信息。</div>;
  }

  const statusCopy = getServerStatusCopy(instance.status);
  const statusVariant = statusCopy.variant;
  const isReady = statusVariant === "ready";
  const isBootstrapping = statusVariant === "bootstrapping";
  const isFailed = statusVariant === "bootstrap_failed";
  const isOffline = statusVariant === "offline";
  const statusReasonDisplay = getServerStatusReasonDisplay(instance);
  const statusSource = getServerStatusSource(instance);
  const tunnelHostname = instance.hostname?.trim() || null;
  const domainUrl = getServerAccessUrl(instance.status, tunnelHostname) || null;
  const isWindowsManual = instance.platform === "windows" && instance.bootstrap_mode === "windows_manual";

  return (
    <div className="flex h-full flex-col space-y-6 pt-2">
      <div className="flex flex-1 flex-col gap-6 overflow-y-auto px-1">
        <div
          className={`flex items-center gap-4 rounded-xl border p-6 ${
            isReady
              ? "border-green-500/20 bg-green-500/10"
              : isOffline
                ? "border-amber-500/20 bg-amber-500/10"
                : isFailed
                  ? "border-red-500/20 bg-red-500/10"
                  : "border-blue-500/20 bg-blue-500/10"
          }`}
        >
          {isReady ? (
            <CheckCircle2 className="size-10 shrink-0 text-green-500" />
          ) : isOffline ? (
            <CircleDashed className="size-10 shrink-0 text-amber-500" />
          ) : isFailed ? (
            <TerminalSquare className="size-10 shrink-0 text-red-500" />
          ) : isBootstrapping ? (
            <Loader2 className="size-10 shrink-0 animate-spin text-blue-500" />
          ) : (
            <CircleDashed className="size-10 shrink-0 text-gray-500" />
          )}

          <div className="min-w-0 flex-1">
            <h3
              className={`truncate text-lg font-semibold ${
                isReady
                  ? "text-green-700 dark:text-green-400"
                  : isOffline
                    ? "text-amber-700 dark:text-amber-400"
                    : isFailed
                      ? "text-red-700 dark:text-red-400"
                      : "text-blue-700 dark:text-blue-400"
              }`}
            >
              {statusCopy.title}
            </h3>
            <p className="mt-1 text-sm opacity-80">
              当前状态:{" "}
              <span className="rounded bg-background/50 px-1.5 py-0.5 font-mono text-xs">
                {instance.status || "unknown"}
              </span>
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <div className="flex min-w-0 flex-col gap-1.5 rounded-lg border bg-muted/30 p-4">
            <span className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              <Server className="size-3.5" /> 实例 ID
            </span>
            <span className="truncate font-mono text-sm" title={instance.id || ""}>
              {instance.id}
            </span>
          </div>

          <div className="flex min-w-0 flex-col gap-1.5 rounded-lg border bg-muted/30 p-4">
            <span className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              <Globe className="size-3.5" /> 域名
            </span>
            {domainUrl && tunnelHostname ? (
              <a
                href={domainUrl}
                target="_blank"
                rel="noreferrer"
                className="truncate font-mono text-sm text-primary transition-colors hover:text-primary/80 hover:underline"
                title={domainUrl}
              >
                {tunnelHostname}
              </a>
            ) : tunnelHostname ? (
              <span className="truncate font-mono text-sm" title={tunnelHostname}>
                {tunnelHostname}
              </span>
            ) : (
              <span className="truncate text-sm italic text-muted-foreground">暂无分配</span>
            )}
          </div>

          <div className="flex min-w-0 flex-col gap-1.5 rounded-lg border bg-muted/30 p-4">
            <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">最后更新</span>
            <span className="text-sm">
              {instance.updated_at ? getRelativeTimeStringCN(instance.updated_at) : "未知"}
            </span>
          </div>
        </div>

        {isWindowsManual ? (
          <div className="rounded-lg border bg-muted/20 p-4">
            <div className="mb-3 flex items-center gap-2 text-sm font-semibold">
              <TerminalSquare className="size-4" /> Windows 启动命令
            </div>
            <InstanceWindowsManualBootstrapView serverId={instance.id} compact showCancel={false} />
          </div>
        ) : null}

        {statusReasonDisplay ? (
          <div className="mb-2 flex flex-col gap-2 rounded-lg border border-destructive/20 bg-destructive/10 p-4">
            <span className="text-xs font-semibold uppercase tracking-wider text-destructive">
              {statusReasonDisplay.label}
            </span>
            <div className="break-words whitespace-pre-wrap rounded bg-background/50 p-2 font-mono text-xs text-destructive/90">
              {statusReasonDisplay.reason}
            </div>
            {statusSource ? (
              <div className="font-mono text-[11px] text-destructive/70">来源: {statusSource}</div>
            ) : null}
          </div>
        ) : null}
      </div>

      <div className="mt-auto flex justify-end gap-3 border-t px-1 pt-4">
        {onClose ? (
          <Button variant="ghost" onClick={onClose}>
            关闭
          </Button>
        ) : null}
        {onSuccess ? <Button onClick={onSuccess}>刷新</Button> : null}
      </div>
    </div>
  );
}
