import { useQueryClient } from "@tanstack/react-query";
import { ChevronDown, ChevronUp, Eye, Play, XCircle } from "lucide-react";
import { useRpcMutation } from "mtmsdk/supabase/use-sb-query/use-rpc-mutation";
import { getRpcQueryKey } from "mtmsdk/supabase/use-sb-query/use-rpc-query";
import { cn } from "mtxuilib/lib/utils";
import { Badge } from "mtxuilib/ui/badge";
import { Button } from "mtxuilib/ui/button";
import { Item, ItemDescription } from "mtxuilib/ui/item";
import Link from "next/link";
import { useState } from "react";
import { toast } from "sonner";
import type { Task } from "./schemas";
import { CodeTypeBadge, TaskStatusBadge, TimeDisplay } from "./task-badges";

interface TaskListItemProps {
  task: Task;
}

export function TaskListItem({ task }: TaskListItemProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const queryClient = useQueryClient();

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

  const canSubmit = ["draft", "paused"].includes(task.status);
  const canCancel = ["draft", "pending", "queued", "paused", "failed"].includes(task.status);

  return (
    <Item className="py-3 items-start group">
      <div className="flex flex-col gap-1 w-full relative">
        <div className="flex items-center gap-2 mb-0.5 flex-wrap w-full pr-12">
          {/* Status Badge */}
          <TaskStatusBadge status={task.status} />

          {/* Code Type Icon + Badge */}
          <CodeTypeBadge type={task.code_type} />

          {/* Title */}
          <span className="font-medium text-sm truncate max-w-[300px]" title={task.title}>
            {task.title || "(No Title)"}
          </span>
          <span className="font-mono text-[10px] text-muted-foreground/60">#{task.id.slice(0, 8)}</span>

          {/* Executor Type (if different from default/server) */}
          {task.executor_type && (
            <Badge
              variant="outline"
              className="text-[10px] px-1.5 h-4 font-normal text-muted-foreground hidden sm:inline-flex"
            >
              {task.executor_type}
            </Badge>
          )}

          {/* Created Time */}
          <TimeDisplay date={task.created_at} />
        </div>

        {/* Description / Summary */}
        <ItemDescription
          className={cn(
            "text-muted-foreground text-xs mt-1 line-clamp-2 break-words pr-12 transition-all",
            isExpanded ? "line-clamp-none whitespace-pre-wrap" : "",
          )}
        >
          {task.description || "No description"}
        </ItemDescription>

        {/* Expanded Details */}
        {isExpanded && (
          <div className="mt-3 space-y-3 bg-muted/30 p-3 rounded-md text-xs border border-muted/50">
            {/* Code Snippet */}
            {task.code && (
              <div>
                <div className="text-[10px] font-semibold text-muted-foreground mb-1 uppercase tracking-wider">
                  Code
                </div>
                <pre className="font-mono bg-background p-2 rounded border overflow-x-auto max-h-[200px]">
                  {task.code}
                </pre>
              </div>
            )}

            {/* Result / Error */}
            {task.error ? (
              <div>
                <div className="text-[10px] font-semibold text-destructive mb-1 uppercase tracking-wider">Error</div>
                <pre className="font-mono bg-destructive/10 text-destructive p-2 rounded border border-destructive/20 overflow-x-auto whitespace-pre-wrap">
                  {task.error}
                </pre>
              </div>
            ) : task.result ? (
              <div>
                <div className="text-[10px] font-semibold text-green-600 dark:text-green-400 mb-1 uppercase tracking-wider">
                  Result
                </div>
                <pre className="font-mono bg-background p-2 rounded border overflow-x-auto max-h-[200px]">
                  {JSON.stringify(task.result, null, 2)}
                </pre>
              </div>
            ) : null}

            {/* Meta */}
            {task.meta && Object.keys(task.meta).length > 0 && (
              <div>
                <div className="text-[10px] font-semibold text-muted-foreground mb-1 uppercase tracking-wider">
                  Meta
                </div>
                <pre className="font-mono bg-background p-2 rounded border overflow-x-auto max-h-[100px] text-[10px]">
                  {JSON.stringify(task.meta, null, 2)}
                </pre>
              </div>
            )}
          </div>
        )}

        {/* Action Buttons (Right Aligned Overlay) */}
        <div className="absolute right-0 top-0 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
          {canSubmit && (
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7 text-green-600 hover:text-green-700 hover:bg-green-50"
              disabled={isSubmitting}
              onClick={(e) => {
                e.preventDefault();
                submitTask({ p_id: task.id });
              }}
              title="提交执行"
            >
              <Play className={cn("h-3.5 w-3.5", isSubmitting && "animate-pulse")} />
            </Button>
          )}

          {canCancel && (
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7 text-destructive hover:text-destructive/80 hover:bg-destructive/5"
              disabled={isCancelling}
              onClick={(e) => {
                e.preventDefault();
                cancelTask({ p_id: task.id });
              }}
              title="取消任务"
            >
              <XCircle className={cn("h-3.5 w-3.5", isCancelling && "animate-pulse")} />
            </Button>
          )}

          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7 text-muted-foreground hover:text-foreground"
            onClick={(e) => {
              e.preventDefault();
              setIsExpanded(!isExpanded);
            }}
          >
            {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
          </Button>

          <Link href={`/dash/tasks/${task.id}`}>
            <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-primary">
              <Eye className="h-4 w-4" />
            </Button>
          </Link>
        </div>
      </div>
    </Item>
  );
}
