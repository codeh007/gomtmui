"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Copy, Edit3, Loader2, Plus, Rocket } from "lucide-react";
import { Badge } from "mtxuilib/ui/badge";
import { Button } from "mtxuilib/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "mtxuilib/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "mtxuilib/ui/table";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { fetchConfigProfiles, fetchRuntimeConfigUrl, publishConfigProfile } from "@/lib/gomtm-configs/api";

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

  const publishMutation = useMutation({
    mutationFn: publishConfigProfile,
    onSuccess: async () => {
      toast.success("配置已发布");
      await queryClient.invalidateQueries({ queryKey: CONFIG_PROFILES_QUERY_KEY });
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : "发布失败");
    },
  });

  const runtimeUrlMutation = useMutation({
    mutationFn: fetchRuntimeConfigUrl,
    onSuccess: async ({ runtime_url }) => {
      await navigator.clipboard.writeText(runtime_url);
      toast.success("Runtime URL 已复制");
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : "复制 Runtime URL 失败");
    },
  });

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
          <div className="space-y-1">
            <CardTitle>配置 Profiles</CardTitle>
            <CardDescription>管理 draft / published gomtm worker 配置，并为 runtime 生成签名配置地址。</CardDescription>
          </div>
          <Button type="button" onClick={() => router.push("/dash/gomtm/configs/new") }>
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
                  <TableHead>状态</TableHead>
                  <TableHead>目标</TableHead>
                  <TableHead>Published</TableHead>
                  <TableHead>更新时间</TableHead>
                  <TableHead className="text-right">操作</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {items.map((item) => {
                  const publishPending = publishMutation.isPending && publishMutation.variables === item.name;
                  const copyPending = runtimeUrlMutation.isPending && runtimeUrlMutation.variables === item.name;

                  return (
                    <TableRow key={item.name}>
                      <TableCell>
                        <div className="font-medium">{item.name}</div>
                        {item.description ? <div className="text-xs text-muted-foreground">{item.description}</div> : null}
                      </TableCell>
                      <TableCell>
                        <Badge variant={item.status === "published" ? "default" : "secondary"}>{item.status}</Badge>
                      </TableCell>
                      <TableCell>{item.target_kind}</TableCell>
                      <TableCell>{item.published_version ?? "-"}</TableCell>
                      <TableCell className="text-muted-foreground">{formatTimestamp(item.updated_at)}</TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2">
                          <Button type="button" variant="outline" size="sm" onClick={() => router.push(`/dash/gomtm/configs/${item.name}`)}>
                            <Edit3 className="mr-2 h-4 w-4" />
                            编辑
                          </Button>
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            disabled={copyPending}
                            onClick={() => runtimeUrlMutation.mutate(item.name)}
                          >
                            {copyPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Copy className="mr-2 h-4 w-4" />}
                            复制 Runtime URL
                          </Button>
                          <Button type="button" size="sm" disabled={publishPending} onClick={() => publishMutation.mutate(item.name)}>
                            {publishPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Rocket className="mr-2 h-4 w-4" />}
                            发布
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
