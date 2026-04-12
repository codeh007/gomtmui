"use client";

import { useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { ArrowLeft, Play, XCircle } from "lucide-react";
import { useRpcMutation } from "mtmsdk/supabase/use-sb-query/use-rpc-mutation";
import { getRpcQueryKey, useRpcQuery } from "mtmsdk/supabase/use-sb-query/use-rpc-query";
import { cn } from "mtxuilib/lib/utils";
import { Badge } from "mtxuilib/ui/badge";
import { Button } from "mtxuilib/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "mtxuilib/ui/card";
import Link from "next/link";
import { useEffect, useRef } from "react";
import { toast } from "sonner";
import { z } from "zod";
import { useLogRealtime } from "../system_log/use-log-realtime";
import { TaskSchema } from "./schemas";
import { TaskStatusBadge } from "./task-badges";

const TaskDetailSchema = z.array(TaskSchema).transform((rows) => rows[0] ?? null);

export function TaskDetailView({ id }: { id: string }) {
  const queryClient = useQueryClient();
  const { data: task, isLoading } = useRpcQuery("task_get", { p_id: id }, { schema: TaskDetailSchema });
  const { data: tree } = useRpcQuery("task_tree", { p_task_id: id }, { schema: z.array(TaskSchema) });

  const invalidateTaskQueries = () => {
    void queryClient.invalidateQueries({ queryKey: getRpcQueryKey("task_list_cursor") });
    void queryClient.invalidateQueries({ queryKey: getRpcQueryKey("task_get") });
  };

  const { mutate: submitTask, isPending: isSubmitting } = useRpcMutation("task_submit", {
    onSuccess: () => {
      invalidateTaskQueries();
    },
    onError: (err) => toast.error(`提交失败: ${err.message}`),
  });

  const { mutate: cancelTask, isPending: isCancelling } = useRpcMutation("task_cancel", {
    onSuccess: () => {
      invalidateTaskQueries();
    },
    onError: (err) => toast.error(`取消失败: ${err.message}`),
  });

  if (isLoading) return <div className="p-8 text-center text-muted-foreground">加载中...</div>;
  if (!task) return <div className="p-8 text-center text-muted-foreground">任务未找到</div>;

  const canSubmit = ["draft", "paused"].includes(task.status);
  const canCancel = ["draft", "pending", "queued", "paused", "failed"].includes(task.status);

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Link href="/dash/tasks">
          <Button variant="ghost" size="icon">
            <ArrowLeft className="w-4 h-4" />
          </Button>
        </Link>
        <div className="flex-1">
          <h1 className="text-2xl font-bold flex items-center gap-3">
            {task.title}
            <TaskStatusBadge status={task.status} />
          </h1>
          <p className="text-muted-foreground text-sm font-mono mt-1 select-all">{task.id}</p>
        </div>
        <div className="flex gap-2">
          {canSubmit && (
            <Button
              className="gap-2"
              variant="default"
              size="sm"
              disabled={isSubmitting}
              onClick={() => submitTask({ p_id: task.id })}
            >
              <Play className={cn("w-4 h-4", isSubmitting && "animate-pulse")} />
              提交执行
            </Button>
          )}
          {canCancel && (
            <Button
              className="gap-2"
              variant="outline"
              size="sm"
              disabled={isCancelling}
              onClick={() => cancelTask({ p_id: task.id })}
            >
              <XCircle className={cn("w-4 h-4", isCancelling && "animate-pulse")} />
              取消任务
            </Button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="col-span-2 space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>代码 / 指令</CardTitle>
            </CardHeader>
            <CardContent>
              <pre className="bg-muted p-4 rounded-md overflow-x-auto text-sm font-mono border whitespace-pre-wrap break-all">
                {task.code || "(无内容)"}
              </pre>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>执行结果</CardTitle>
            </CardHeader>
            <CardContent>
              {task.error && (
                <div className="bg-destructive/10 text-destructive p-4 rounded-md mb-4 border border-destructive/20">
                  <h4 className="font-bold mb-2 flex items-center gap-2">execution error</h4>
                  <pre className="whitespace-pre-wrap text-sm font-mono">{task.error}</pre>
                </div>
              )}
              {task.result_text && (
                <div className="bg-muted p-4 rounded-md border">
                  <pre className="whitespace-pre-wrap text-sm font-mono">{task.result_text}</pre>
                </div>
              )}
              {!task.result_text && !task.error && <div className="text-muted-foreground text-sm italic">暂无结果</div>}

              {task.result && (
                <div className="mt-4">
                  <h4 className="font-medium mb-2 text-sm">JSON Result</h4>
                  <pre className="bg-muted p-4 rounded-md border text-xs font-mono overflow-auto max-h-[300px]">
                    {JSON.stringify(task.result, null, 2)}
                  </pre>
                </div>
              )}
            </CardContent>
          </Card>

          <TaskLogStream taskId={id} />
        </div>

        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>任务信息</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 text-sm">
              <div className="flex justify-between items-center py-1 border-b border-border/50">
                <span className="text-muted-foreground">类型</span>
                <Badge variant="outline">{task.code_type}</Badge>
              </div>
              <div className="flex justify-between items-center py-1 border-b border-border/50">
                <span className="text-muted-foreground">执行器</span>
                <span className="font-medium font-mono">{task.executor_type || "-"}</span>
              </div>
              <div className="flex justify-between items-center py-1 border-b border-border/50">
                <span className="text-muted-foreground">Executor ID</span>
                <span className="font-medium font-mono text-xs truncate max-w-[150px]" title={task.executor_id || ""}>
                  {task.executor_id || "-"}
                </span>
              </div>
              <div className="flex justify-between items-center py-1 border-b border-border/50">
                <span className="text-muted-foreground">优先级</span>
                <span className="font-medium">{task.priority}</span>
              </div>
              <div className="flex justify-between items-center py-1 border-b border-border/50">
                <span className="text-muted-foreground">重试次数</span>
                <span className="font-medium">
                  {task.retry_count} / {task.max_retries}
                </span>
              </div>

              <div className="pt-2 space-y-3">
                <div className="flex justify-between text-xs">
                  <span className="text-muted-foreground">创建时间</span>
                  <span className="font-mono">
                    {task.created_at ? format(new Date(task.created_at), "yyyy-MM-dd HH:mm:ss") : "-"}
                  </span>
                </div>
                <div className="flex justify-between text-xs">
                  <span className="text-muted-foreground">开始时间</span>
                  <span className="font-mono">
                    {task.started_at ? format(new Date(task.started_at), "yyyy-MM-dd HH:mm:ss") : "-"}
                  </span>
                </div>
                <div className="flex justify-between text-xs">
                  <span className="text-muted-foreground">完成时间</span>
                  <span className="font-mono">
                    {task.completed_at ? format(new Date(task.completed_at), "yyyy-MM-dd HH:mm:ss") : "-"}
                  </span>
                </div>
              </div>
            </CardContent>
          </Card>

          {tree && tree.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>任务链路 ({tree.length})</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 max-h-[400px] overflow-y-auto">
                {tree.map((t, _i) => (
                  <Link
                    href={`/dash/tasks/${t.id}`}
                    key={t.id}
                    className={`block p-3 rounded-md border transition-colors ${t.id === id ? "bg-primary/5 border-primary shadow-sm" : "hover:bg-muted/50"}`}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <div className="text-sm font-medium truncate flex-1">{t.title}</div>
                      <TaskStatusBadge status={t.status} size="xs" />
                    </div>
                    <div className="flex justify-between text-xs text-muted-foreground">
                      <span className="font-mono">{t.code_type}</span>
                      <span>{format(new Date(t.created_at), "MM-dd HH:mm")}</span>
                    </div>
                  </Link>
                ))}
              </CardContent>
            </Card>
          )}

          {task.meta && (
            <Card>
              <CardHeader>
                <CardTitle>Meta</CardTitle>
              </CardHeader>
              <CardContent>
                <pre className="text-xs font-mono bg-muted p-2 rounded overflow-auto max-h-[200px]">
                  {JSON.stringify(task.meta, null, 2)}
                </pre>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}

const SysLogSchema = z.object({
  id: z.coerce.string(),
  created_at: z.string(),
  text: z.string(),
  level: z.enum(["error", "warn", "info"]),
  module: z.string(),
  event_type: z.string(),
  meta: z.any().nullable(),
  resource_type: z.string().nullable(),
  resource_id: z.string().nullable(),
  user_id: z.string().nullable(),
});

function highlightLogText(text: string) {
  const regex = /\b(error|failed|failure|success|done|warn|warning|exception)\b/gi;
  const parts = text.split(regex);
  return parts.map((part, i) => {
    const lower = part.toLowerCase();
    if (["error", "failed", "failure", "exception"].includes(lower)) {
      return (
        <span key={i} className="text-destructive font-bold">
          {part}
        </span>
      );
    }
    if (["success", "done"].includes(lower)) {
      return (
        <span key={i} className="text-emerald-500 font-bold">
          {part}
        </span>
      );
    }
    if (["warn", "warning"].includes(lower)) {
      return (
        <span key={i} className="text-amber-500 font-bold">
          {part}
        </span>
      );
    }
    return <span key={i}>{part}</span>;
  });
}

function TaskLogStream({ taskId }: { taskId: string }) {
  const query = useRpcQuery(
    "log_list_unified",
    {
      p_source: "system",
      p_scope: "all",
      p_limit: 100,
      p_resource_type: "task",
      p_resource_id: taskId,
    },
    {
      schema: z.array(SysLogSchema),
    },
  );

  useLogRealtime("log_list_unified");

  const logs = query.data || [];
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [logs]);

  return (
    <Card>
      <CardHeader>
        <CardTitle>实时执行日志</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="bg-muted p-4 rounded-md border text-sm font-mono overflow-auto max-h-[400px]">
          {logs.length === 0 ? (
            <div className="text-muted-foreground italic">暂无日志...</div>
          ) : (
            <div className="space-y-1">
              {[...logs].reverse().map((log) => {
                const color =
                  log.level === "error"
                    ? "text-destructive"
                    : log.level === "warn"
                      ? "text-amber-500"
                      : "text-muted-foreground";
                return (
                  <div key={log.id} className="whitespace-pre-wrap break-all flex flex-col sm:flex-row gap-2">
                    <span className="text-muted-foreground/50 shrink-0">
                      [{format(new Date(log.created_at), "HH:mm:ss")}]
                    </span>
                    <span className={color}>
                      [{log.level.toUpperCase()}] {highlightLogText(log.text)}
                    </span>
                  </div>
                );
              })}
              <div ref={bottomRef} />
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
