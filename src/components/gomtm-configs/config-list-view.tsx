"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Copy, Loader2, Plus, Trash2 } from "lucide-react";
import { Button } from "mtxuilib/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "mtxuilib/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "mtxuilib/ui/table";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { deleteConfigProfile, fetchConfigProfiles, fetchStartupCommand } from "@/lib/gomtm-configs/api";

const CONFIG_PROFILES_QUERY_KEY = ["gomtm-config-profiles"] as const;

function formatTimestamp(value: string | null | undefined) {
  if (!value) {
    return "-";
  }

  return new Date(value).toLocaleString();
}

export function ConfigListView() {
  const router = useRouter();
  const queryClient = useQueryClient();

  const profilesQuery = useQuery({
    queryKey: CONFIG_PROFILES_QUERY_KEY,
    queryFn: fetchConfigProfiles,
  });
  const items = profilesQuery.data?.items ?? [];

  const startupCommandMutation = useMutation({
    mutationFn: fetchStartupCommand,
    onSuccess: async ({ command }) => {
      await navigator.clipboard.writeText(command);
      toast.success("启动命令已复制");
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : "复制启动命令失败");
    },
  });

  const deleteMutation = useMutation({
    mutationFn: deleteConfigProfile,
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: CONFIG_PROFILES_QUERY_KEY });
      toast.success("配置已删除");
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : "删除配置失败");
    },
  });

  const handleDelete = (name: string) => {
    if (!window.confirm(`确定要删除配置 ${name} 吗？`)) {
      return;
    }

    deleteMutation.mutate(name);
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
          <div className="space-y-1">
            <CardTitle>配置 Profiles</CardTitle>
            <CardDescription>管理 gomtm worker 当前配置，并为 Linux runtime 复制受管启动命令。</CardDescription>
          </div>
          <Button type="button" onClick={() => router.push("/dash/gomtm/configs/new")}>
            <Plus className="mr-2 h-4 w-4" />
            新建配置
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {profilesQuery.isLoading ? (
          <div className="flex items-center gap-2 py-8 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            加载配置列表...
          </div>
        ) : profilesQuery.isError ? (
          <div className="rounded-md border border-destructive/30 px-4 py-3 text-sm text-destructive">
            {profilesQuery.error instanceof Error ? profilesQuery.error.message : "加载配置列表失败"}
          </div>
        ) : !items.length ? (
          <div className="py-8 text-sm text-muted-foreground">暂无配置 profiles。</div>
        ) : (
          <div className="overflow-hidden rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>名称</TableHead>
                  <TableHead>更新时间</TableHead>
                  <TableHead className="text-right">操作</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {items.map((item) => {
                  const copyPending = startupCommandMutation.isPending && startupCommandMutation.variables === item.name;
                  const deletePending = deleteMutation.isPending && deleteMutation.variables === item.name;
                  const rowActionsDisabled = deletePending || copyPending;
                  const metadata = item.description?.trim() ?? "";

                  return (
                    <TableRow key={item.name}>
                      <TableCell>
                        <Button
                          type="button"
                          variant="ghost"
                          className="h-auto p-0 font-medium"
                          disabled={rowActionsDisabled}
                          onClick={() => router.push(`/dash/gomtm/configs/${item.name}`)}
                        >
                          {item.name}
                        </Button>
                        {metadata ? <div className="text-xs text-muted-foreground">{metadata}</div> : null}
                      </TableCell>
                      <TableCell className="text-muted-foreground">{formatTimestamp(item.updated_at)}</TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2">
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            disabled={copyPending || rowActionsDisabled}
                            onClick={() => startupCommandMutation.mutate(item.name)}
                          >
                            {copyPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Copy className="mr-2 h-4 w-4" />}
                            复制启动命令
                          </Button>
                          <Button type="button" variant="outline" size="sm" disabled={rowActionsDisabled} onClick={() => handleDelete(item.name)}>
                            {deletePending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Trash2 className="mr-2 h-4 w-4" />}
                            删除
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
