"use client";

import { useQueryClient } from "@tanstack/react-query";
import { Edit, Megaphone, Pause, Play, Plus, Search, Trash2 } from "lucide-react";
import { useRpcMutation } from "mtmsdk/supabase/use-sb-query/use-rpc-mutation";
import { getRpcQueryKey, useRpcQuery } from "mtmsdk/supabase/use-sb-query/use-rpc-query";
import { InlineLoading } from "mtxuilib/mt/skeletons";
import { Badge } from "mtxuilib/ui/badge";
import { Button } from "mtxuilib/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "mtxuilib/ui/dialog";
import { Input } from "mtxuilib/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "mtxuilib/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "mtxuilib/ui/table";
import Link from "next/link";
import { useState } from "react";
import { toast } from "sonner";
import { z } from "zod";
import { CampaignRecordSchema } from "@/components/campaigns/schemas";
import { ErrorBoundary } from "@/components/common/error-boundary";
import { DashContent, DashHeaders } from "@/components/dash-layout";
import { useDebounce } from "@/hooks/use-debounce";

const statusColors: Record<string, string> = {
  active: "bg-emerald-500/15 text-emerald-600 border-emerald-500/30",
  paused: "bg-amber-500/15 text-amber-600 border-amber-500/30",
  completed: "bg-blue-500/15 text-blue-600 border-blue-500/30",
  draft: "bg-zinc-500/15 text-zinc-600 border-zinc-500/30",
};

export default function CampaignsPage() {
  const queryClient = useQueryClient();
  const [kw, setKw] = useState("");
  const [status, setStatus] = useState("all");
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const kwDebounced = useDebounce(kw, 500);

  const { data: campaigns, isLoading } = useRpcQuery(
    "campaign_list_cursor",
    {
      p_limit: 100,
      ...(status !== "all" && { p_status: status }),
      ...(kwDebounced && { p_search: kwDebounced }),
    },
    { schema: z.array(CampaignRecordSchema) },
  );

  const deleteMutation = useRpcMutation("campaign_delete", {
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: getRpcQueryKey("campaign_list_cursor") });
      setDeleteId(null);
      toast.success("活动已删除");
    },
    onError: (err) => {
      toast.error(`删除失败: ${err.message}`);
    },
  });

  const pauseMutation = useRpcMutation("campaign_pause", {
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: getRpcQueryKey("campaign_list_cursor") });
      toast.success("活动已暂停");
    },
  });

  const startMutation = useRpcMutation("campaign_start", {
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: getRpcQueryKey("campaign_list_cursor") });
      toast.success("活动已启动");
    },
  });

  const handleDelete = () => {
    if (!deleteId) return;
    deleteMutation.mutate({ p_id: deleteId });
  };

  const handleStatusToggle = (id: string, currentStatus?: string | null) => {
    if (currentStatus === "active") {
      pauseMutation.mutate({ p_id: id });
    } else {
      startMutation.mutate({ p_id: id });
    }
  };

  return (
    <>
      <DashHeaders>
        <div className="flex flex-col">
          <h1 className="text-lg font-semibold">推广活动</h1>
          <p className="text-xs text-muted-foreground">管理社交媒体营销活动</p>
        </div>
      </DashHeaders>

      <DashContent className="flex flex-col gap-4 p-4 md:p-6 overflow-hidden">
        <ErrorBoundary name="CampaignsList">
          <div className="flex flex-col md:flex-row gap-3 justify-between items-start md:items-center">
            <div className="flex flex-1 w-full md:w-auto gap-2 items-center">
              <div className="relative flex-1 md:max-w-sm">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  type="search"
                  placeholder="搜索活动..."
                  className="pl-9"
                  value={kw}
                  onChange={(e) => setKw(e.target.value)}
                />
              </div>
              <Select value={status} onValueChange={setStatus}>
                <SelectTrigger className="w-[130px]">
                  <SelectValue placeholder="状态" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">所有状态</SelectItem>
                  <SelectItem value="active">进行中</SelectItem>
                  <SelectItem value="paused">已暂停</SelectItem>
                  <SelectItem value="draft">草稿</SelectItem>
                  <SelectItem value="completed">已完成</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <Button asChild>
              <Link href="/dash/campaigns/new">
                <Plus className="mr-1.5 h-4 w-4" />
                新建活动
              </Link>
            </Button>
          </div>

          <div className="flex-1 min-h-0 overflow-auto rounded-lg border border-border/50">
            {isLoading ? (
              <InlineLoading />
            ) : !campaigns || campaigns.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 text-muted-foreground gap-3">
                <Megaphone className="h-10 w-10 opacity-20" />
                <p className="text-lg font-medium">暂无推广活动</p>
                <Button variant="outline" asChild>
                  <Link href="/dash/campaigns/new">
                    <Plus className="mr-1.5 h-4 w-4" />
                    立即创建
                  </Link>
                </Button>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/30">
                    <TableHead>活动名称</TableHead>
                    <TableHead>平台</TableHead>
                    <TableHead>状态</TableHead>
                    <TableHead>统计</TableHead>
                    <TableHead>创建时间</TableHead>
                    <TableHead className="text-right">操作</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {campaigns.map((campaign) => (
                    <TableRow key={campaign.id}>
                      <TableCell className="font-medium">
                        <div className="flex flex-col">
                          <Link href={`/dash/campaigns/${campaign.id}`} className="hover:underline font-semibold block">
                            {campaign.name}
                          </Link>
                          {campaign.description && (
                            <span className="text-muted-foreground text-xs truncate max-w-[200px]">
                              {campaign.description}
                            </span>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="capitalize">{campaign.platform}</TableCell>
                      <TableCell>
                        <Badge variant="outline" className={statusColors[campaign.status || "draft"] || ""}>
                          {campaign.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-sm">
                        <div className="text-xs text-muted-foreground">Tasks: {campaign.stats?.total_tasks || 0}</div>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {campaign.created_at ? new Date(campaign.created_at).toLocaleDateString() : "-"}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2">
                          {(campaign.status === "active" ||
                            campaign.status === "paused" ||
                            campaign.status === "draft") && (
                            <Button
                              variant="ghost"
                              size="icon"
                              title={campaign.status === "active" ? "暂停" : "启动"}
                              onClick={() => handleStatusToggle(campaign.id, campaign.status)}
                            >
                              {campaign.status === "active" ? (
                                <Pause className="h-4 w-4" />
                              ) : (
                                <Play className="h-4 w-4" />
                              )}
                            </Button>
                          )}
                          <Button variant="ghost" size="icon" asChild title="编辑">
                            <Link href={`/dash/campaigns/${campaign.id}/edit`}>
                              <Edit className="h-4 w-4" />
                            </Link>
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="text-destructive hover:text-destructive"
                            onClick={() => setDeleteId(campaign.id)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </div>
        </ErrorBoundary>
      </DashContent>

      <Dialog open={!!deleteId} onOpenChange={(open) => !open && setDeleteId(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>确认删除活动?</DialogTitle>
            <DialogDescription>此操作将永久删除该活动及其关联的所有任务数据，无法恢复。</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteId(null)}>
              取消
            </Button>
            <Button variant="destructive" onClick={handleDelete} disabled={deleteMutation.isPending}>
              {deleteMutation.isPending ? "删除中..." : "确认删除"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
