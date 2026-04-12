"use client";

import { useQueryClient } from "@tanstack/react-query";
import { ListFilter, Plus } from "lucide-react";
import { useSupabaseBrowser } from "mtmsdk/supabase/context";
import { getRpcQueryKey, useRpcQuery } from "mtmsdk/supabase/use-sb-query/use-rpc-query";
import { LoadingSpinner } from "mtxuilib/mt/skeletons";
import { Button } from "mtxuilib/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "mtxuilib/ui/card";
import { ItemGroup } from "mtxuilib/ui/item";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "mtxuilib/ui/select";
import { useEffect, useState } from "react";
import { z } from "zod";
import { CreateTaskDialog } from "./create-task-dialog";
import { TaskSchema } from "./schemas";
import { TaskListItem } from "./task-list-item";

type TaskStatusFilter =
  | "all"
  | "draft"
  | "pending"
  | "queued"
  | "running"
  | "completed"
  | "failed"
  | "cancelled"
  | "paused";
type TaskCodeTypeFilter = "all" | "sql" | "bash" | "python" | "agent";

export function TaskListView({ contextType, contextId }: { contextType?: string; contextId?: string }) {
  const sb = useSupabaseBrowser();
  const queryClient = useQueryClient();
  const [status, setStatus] = useState<TaskStatusFilter>("all");
  const [codeType, setCodeType] = useState<TaskCodeTypeFilter>("all");
  const [limit, setLimit] = useState(50);

  useEffect(() => {
    const channel = sb
      .channel("tasks_realtime")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "tasks",
        },
        () => {
          void queryClient.invalidateQueries({
            queryKey: getRpcQueryKey("task_list_cursor"),
          });
        },
      )
      .subscribe();

    return () => {
      void sb.removeChannel(channel);
    };
  }, [sb, queryClient]);

  const query = useRpcQuery(
    "task_list_cursor",
    {
      p_limit: limit,
      p_context_type: contextType || undefined,
      p_context_id: contextId || undefined,
      p_status: status === "all" ? undefined : status,
      p_code_type: codeType === "all" ? undefined : codeType,
    },
    {
      schema: z.array(TaskSchema),
    },
  );

  const tasks = query.data || [];
  const isLoading = query.isLoading;

  return (
    <div className="space-y-4">
      {/* Header / Filters */}
      <Card className="border-none shadow-none text-muted-foreground bg-muted/20">
        <CardHeader className="py-3 px-4">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex flex-wrap items-center gap-6">
              {/* Status Filter */}
              <div className="flex items-center gap-2">
                <span className="text-[10px] uppercase tracking-wider font-semibold">状态</span>
                <Select
                  value={status}
                  onValueChange={(v) => {
                    setStatus(v as TaskStatusFilter);
                    setLimit(50);
                  }}
                >
                  <SelectTrigger className="w-[110px] h-7 text-[11px] bg-background">
                    <SelectValue placeholder="All Status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">全部</SelectItem>
                    <SelectItem value="draft">草稿</SelectItem>
                    <SelectItem value="pending">等待中</SelectItem>
                    <SelectItem value="queued">排队中</SelectItem>
                    <SelectItem value="running">运行中</SelectItem>
                    <SelectItem value="completed">已完成</SelectItem>
                    <SelectItem value="failed">失败</SelectItem>
                    <SelectItem value="cancelled">已取消</SelectItem>
                    <SelectItem value="paused">已暂停</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Code Type Filter */}
              <div className="flex items-center gap-2">
                <span className="text-[10px] uppercase tracking-wider font-semibold">类型</span>
                <Select
                  value={codeType}
                  onValueChange={(v) => {
                    setCodeType(v as TaskCodeTypeFilter);
                    setLimit(50);
                  }}
                >
                  <SelectTrigger className="w-[110px] h-7 text-[11px] bg-background">
                    <SelectValue placeholder="All Types" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">全部</SelectItem>
                    <SelectItem value="sql">SQL</SelectItem>
                    <SelectItem value="bash">Bash</SelectItem>
                    <SelectItem value="python">Python</SelectItem>
                    <SelectItem value="agent">Agent</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Actions */}
            <div className="flex items-center gap-2">
              <CreateTaskDialog contextType={contextType} contextId={contextId}>
                <Button size="sm" className="h-7 text-xs">
                  <Plus className="mr-1.5 h-3.5 w-3.5" />
                  新建任务
                </Button>
              </CreateTaskDialog>
            </div>
          </div>
        </CardHeader>
      </Card>

      {/* Task List */}
      <Card className="border shadow-sm">
        <CardHeader className="flex flex-row items-center justify-between py-4 px-4 border-b">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <ListFilter className="w-4 h-4 text-muted-foreground" />
            任务列表
          </CardTitle>
          <div className="text-xs text-muted-foreground">{isLoading ? "加载中..." : `${tasks.length} / ${limit}`}</div>
        </CardHeader>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="flex justify-center items-center py-20">
              <LoadingSpinner />
            </div>
          ) : tasks.length === 0 ? (
            <div className="text-center py-10 text-muted-foreground text-sm">暂无任务</div>
          ) : (
            <ItemGroup>
              {tasks.map((task) => (
                <TaskListItem key={task.id} task={task} />
              ))}
            </ItemGroup>
          )}
        </CardContent>
      </Card>

      {/* Load More */}
      {tasks.length >= limit && (
        <div className="flex justify-center pb-4">
          <Button variant="ghost" size="sm" onClick={() => setLimit(limit + 50)}>
            加载更多
          </Button>
        </div>
      )}
    </div>
  );
}
