"use client";

import { useQueryClient } from "@tanstack/react-query";
import { Circle, Globe, Loader2, MoreVertical, Plus, Search, Server, Trash2 } from "lucide-react";
import { useRpcMutation } from "mtmsdk/supabase/use-sb-query/use-rpc-mutation";
import { getRpcQueryKey } from "mtmsdk/supabase/use-sb-query/use-rpc-query";
import { cn, getRelativeTimeStringCN } from "mtxuilib/lib/utils";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "mtxuilib/ui/alert-dialog";
import { Button } from "mtxuilib/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "mtxuilib/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "mtxuilib/ui/dropdown-menu";
import { Input } from "mtxuilib/ui/input";
import { Item, ItemActions, ItemContent, ItemGroup, ItemMedia, ItemTitle } from "mtxuilib/ui/item";
import { useState } from "react";
import { useDebounce } from "@/hooks/use-debounce";
import { ListSkeleton } from "../common/list-skeleton";
import { useServerInstanceListInfinite } from "./hooks";
import { InstanceBootstrapView } from "./instance-bootstrap-view";
import { InstanceCreateView } from "./instance-create-view";
import {
  getServerAccessUrl,
  getServerStatusCopy,
  getServerStatusReasonDisplay,
  type ServerInstanceStatusDto,
} from "./status-contract";

type ServerInstanceListItem = ServerInstanceStatusDto;

export function ServerInstanceList() {
  const queryClient = useQueryClient();
  const [pageSize] = useState(20);
  const [searchKw, setSearchKw] = useState("");
  const debouncedSearchKw = useDebounce(searchKw, 500);

  const [autoBootstrapDialogOpen, setAutoBootstrapDialogOpen] = useState(false);
  const [bootstrapTarget, setBootstrapTarget] = useState<{
    id: string;
  } | null>(null);

  const [deletingId, setDeletingId] = useState<string | null>(null);

  const listQuery = useServerInstanceListInfinite({
    pageSize,
    kw: debouncedSearchKw,
  });

  const invalidateList = () => {
    void queryClient.invalidateQueries({ queryKey: getRpcQueryKey("server_list_cursor") });
  };

  const deleteMutation = useRpcMutation("server_delete");

  const handleDelete = async (id: string) => {
    if (!id) {
      return { ok: false, error: "缺少实例 ID" };
    }

    // 保持交互简单：一次只处理一个删除动作。
    if (deleteMutation.isPending) {
      return { ok: false, error: "正在删除中，请稍候" };
    }

    setDeletingId(id);

    try {
      const result = await deleteMutation.mutateAsync({
        p_id: id,
        p_shutdown_gracefully: true,
      });

      if (result.error) {
        const code = result.error.code ? ` [${result.error.code}]` : "";
        const details = result.error.details ? ` · ${result.error.details}` : "";
        const hint = result.error.hint ? ` · ${result.error.hint}` : "";
        throw new Error(`${result.error.message}${code}${details}${hint}`);
      }

      invalidateList();
      return { ok: true };
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : String(e);
      return { ok: false, error: message || "未知错误" };
    } finally {
      setDeletingId(null);
    }
  };

  const isEmpty = !listQuery.isLoading && !listQuery.data?.pages?.[0]?.length;

  return (
    <div className="flex flex-col h-full w-full space-y-4">
      <div className="flex items-center justify-between">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="搜索实例 ID..."
            className="pl-8"
            value={searchKw}
            onChange={(e) => setSearchKw(e.target.value)}
          />
        </div>

        <div className="flex items-center gap-2">
          {/* guided automated bootstrap */}
          <Dialog open={autoBootstrapDialogOpen} onOpenChange={setAutoBootstrapDialogOpen}>
            <DialogTrigger asChild>
              <Button size="sm" variant="default" className="gap-2 bg-blue-600 hover:bg-blue-700 text-white shadow-md">
                <Plus className="size-4" />
                实例
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-[calc(100vw-2rem)] sm:max-w-[680px]">
              <DialogHeader>
                <DialogTitle>创建服务实例</DialogTitle>
                <DialogDescription className="sr-only">为 Windows 手动引导实例生成一键启动命令。</DialogDescription>
              </DialogHeader>
              <InstanceCreateView
                onCreated={() => {
                  invalidateList();
                }}
                onCancel={() => setAutoBootstrapDialogOpen(false)}
              />
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* 列表内容 */}
      <div className="space-y-4 pb-8 overflow-x-auto min-w-0">
        {listQuery.isLoading ? (
          <ListSkeleton count={3} />
        ) : isEmpty ? (
          <div className="flex flex-col items-center justify-center h-40 bg-muted/10 rounded-md gap-2">
            <Server className="size-8 opacity-20" />
            <span className="text-muted-foreground">暂无服务实例，请添加</span>
          </div>
        ) : (
          <ItemGroup>
            {listQuery.data?.pages.map((page) =>
              page.map((instance) => (
                <ServerInstanceItem
                  key={instance.id}
                  instance={instance}
                  isDeleting={deleteMutation.isPending && deletingId === instance.id}
                  onDelete={handleDelete}
                  onBootstrap={(target) => setBootstrapTarget(target)}
                />
              )),
            )}
          </ItemGroup>
        )}

        {/* Load More Button */}
        {listQuery.hasNextPage && (
          <div className="flex justify-center pt-2">
            <Button
              variant="outline"
              onClick={() => listQuery.fetchNextPage()}
              disabled={listQuery.isFetchingNextPage}
              className="min-w-[120px]"
            >
              {listQuery.isFetchingNextPage ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  加载中...
                </>
              ) : (
                "加载更多"
              )}
            </Button>
          </div>
        )}
      </div>

      {/* Bootstrap Dialog */}
      <Dialog open={!!bootstrapTarget} onOpenChange={(open) => !open && setBootstrapTarget(null)}>
        <DialogContent className="sm:max-w-[720px] w-[90vw] max-h-[80vh] flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">实例详情</DialogTitle>
            <DialogDescription className="sr-only">查看服务实例当前引导状态与诊断信息。</DialogDescription>
          </DialogHeader>
          <InstanceBootstrapView instanceID={bootstrapTarget?.id || ""} onClose={() => setBootstrapTarget(null)} />
        </DialogContent>
      </Dialog>
    </div>
  );
}

const ServerInstanceItem = ({
  instance,
  isDeleting,
  onDelete,
  onBootstrap,
}: {
  instance: ServerInstanceListItem;
  isDeleting: boolean;
  onDelete: (id: string) => Promise<{ ok: boolean; error?: string }>;
  onBootstrap: (target: { id: string }) => void;
}) => {
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const statusCopy = getServerStatusCopy(instance.status);
  const statusVariant = statusCopy.variant;
  const statusReasonDisplay = getServerStatusReasonDisplay(instance);
  const tunnelHostname = instance.hostname?.trim() || null;
  const domainUrl = getServerAccessUrl(instance.status, tunnelHostname) || null;

  const isReady = statusVariant === "ready";
  const isBootstrapping = statusVariant === "bootstrapping";
  const isFailed = statusVariant === "bootstrap_failed";
  const isOffline = statusVariant === "offline";

  const handleBootstrap = () => {
    onBootstrap({
      id: instance.id ?? "",
    });
  };

  return (
    <Item>
      <ItemMedia className="mt-1 text-slate-600 dark:text-slate-400">
        <Server className="size-6" />
      </ItemMedia>

      <ItemContent>
        <div className="flex items-center gap-2 flex-wrap">
          <ItemTitle className="text-base font-semibold flex items-center gap-2">
            {instance.id?.substring(0, 8) || "Unknown"}
          </ItemTitle>

          {/* 实例状态标签 */}
          <div
            className={cn(
              "text-[10px] px-2 py-0.5 rounded-full flex items-center gap-1.5 border",
              isReady
                ? "bg-green-500/10 text-green-600 border-green-500/20"
                : isBootstrapping
                  ? "bg-blue-500/10 text-blue-600 border-blue-500/20"
                  : isOffline
                    ? "bg-amber-500/10 text-amber-600 border-amber-500/20"
                    : isFailed
                      ? "bg-red-500/10 text-red-600 border-red-500/20"
                      : "bg-gray-500/10 text-gray-600 border-gray-500/20",
            )}
          >
            {isBootstrapping ? (
              <Loader2 className="size-3 animate-spin" />
            ) : (
              <Circle
                className={cn(
                  "size-2 fill-current",
                  isReady
                    ? "text-green-500"
                    : isOffline
                      ? "text-amber-500"
                      : isFailed
                        ? "text-red-500"
                        : "text-gray-500",
                )}
              />
            )}
            <span>{statusCopy.compactLabel}</span>
          </div>
        </div>

        <div className="text-sm text-muted-foreground mt-1 space-y-1">
          <div className="text-sm text-muted-foreground">
            <div className="flex items-center gap-4 text-xs font-mono text-muted-foreground">
              {domainUrl && tunnelHostname ? (
                <a
                  href={domainUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1 text-primary hover:underline hover:text-primary/80 transition-colors min-w-0"
                  title={domainUrl}
                >
                  <Globe className="size-3 shrink-0" />
                  <span className="truncate">{tunnelHostname}</span>
                </a>
              ) : tunnelHostname ? (
                <span
                  className="flex items-center gap-1 min-w-0 text-amber-600/90 dark:text-amber-400/90"
                  title={tunnelHostname}
                >
                  <Globe className="size-3 shrink-0" />
                  <span className="truncate">{tunnelHostname}</span>
                </span>
              ) : (
                <span className="text-amber-500/70 italic">未分配访问域名</span>
              )}
              <span>更新于: {getRelativeTimeStringCN(instance.updated_at || "")}</span>
            </div>
          </div>
          {statusReasonDisplay && (
            <div className="text-xs text-destructive/90 font-mono break-words bg-destructive/10 border border-destructive/20 rounded px-2 py-1.5">
              {statusReasonDisplay.label}: {statusReasonDisplay.reason}
            </div>
          )}
        </div>
      </ItemContent>

      <ItemActions className="flex items-center gap-2">
        <Button variant="outline" size="sm" onClick={handleBootstrap}>
          详情
        </Button>

        <div className="flex items-center gap-1">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="h-8 w-8" aria-label="更多操作">
                <MoreVertical className="size-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <AlertDialog
                open={deleteConfirmOpen}
                onOpenChange={(nextOpen) => {
                  if (isDeleting) return;
                  setDeleteConfirmOpen(nextOpen);
                }}
              >
                <AlertDialogTrigger asChild>
                  <DropdownMenuItem
                    onSelect={(e) => {
                      e.preventDefault();
                      setDeleteError(null);
                    }}
                    className="text-destructive focus:text-destructive"
                  >
                    <Trash2 className="mr-2 size-4" />
                    删除
                  </DropdownMenuItem>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>确认删除该服务实例？</AlertDialogTitle>
                    <AlertDialogDescription>
                      {isDeleting
                        ? `正在删除中，请稍候...（ID: ${instance.id?.substring(0, 8) || "Unknown"}）`
                        : `此操作不可逆，将尝试优雅下线并删除该实例（ID: ${instance.id?.substring(0, 8) || "Unknown"}）。`}
                    </AlertDialogDescription>
                    {deleteError ? <p className="text-sm text-destructive">删除失败: {deleteError}</p> : null}
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel disabled={isDeleting}>取消</AlertDialogCancel>
                    <AlertDialogAction
                      disabled={isDeleting}
                      onClick={(e) => {
                        e.preventDefault();
                        void (async () => {
                          const result = await onDelete(instance.id ?? "");
                          if (result.ok) {
                            setDeleteConfirmOpen(false);
                            setDeleteError(null);
                            return;
                          }
                          setDeleteError(result.error ?? "未知错误");
                        })();
                      }}
                      className="bg-red-600 hover:bg-red-700"
                    >
                      {isDeleting ? <Loader2 className="mr-2 size-4 animate-spin" /> : null}
                      {isDeleting ? "正在删除..." : "删除"}
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </ItemActions>
    </Item>
  );
};
