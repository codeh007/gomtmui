import { format, formatDistanceToNow } from "date-fns";
import { zhCN } from "date-fns/locale";
import { Bot, Code2, Database, Terminal } from "lucide-react";
import { cn } from "mtxuilib/lib/utils";
import { Badge } from "mtxuilib/ui/badge";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "mtxuilib/ui/tooltip";

export type TaskStatus =
  | "draft"
  | "pending"
  | "queued"
  | "running"
  | "completed"
  | "failed"
  | "cancelled"
  | "paused"
  | string;
export type CodeType = "sql" | "bash" | "python" | "agent" | string;

export function TaskStatusBadge({ status, size = "default" }: { status: TaskStatus; size?: "default" | "xs" }) {
  const variants: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
    draft: "secondary",
    pending: "outline",
    queued: "outline",
    running: "default",
    completed: "default",
    failed: "destructive",
    cancelled: "secondary",
    paused: "outline",
  };

  const statusMap: Record<string, string> = {
    draft: "草稿",
    pending: "等待",
    queued: "排队",
    running: "运行中",
    completed: "完成",
    failed: "失败",
    cancelled: "取消",
    paused: "暂停",
  };

  const statusText = statusMap[status] || status;

  let className =
    status === "completed"
      ? "bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 border-transparent hover:bg-green-200 dark:hover:bg-green-900/50"
      : status === "running"
        ? "animate-pulse bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 border-transparent"
        : "";

  if (size === "xs") {
    className = cn(className, "text-[10px] px-1 h-4 min-w-[2rem]");
  } else {
    className = cn(className, "capitalize font-normal text-[10px] px-1.5 h-4 shadow-none min-w-[3rem] justify-center");
  }

  return (
    <Badge variant={variants[status] || "outline"} className={className}>
      {statusText}
    </Badge>
  );
}

export function CodeTypeBadge({ type }: { type: CodeType | null }) {
  if (!type) return null;

  const icons: Record<string, React.ElementType> = {
    sql: Database,
    bash: Terminal,
    python: Code2,
    agent: Bot,
  };

  const Icon = icons[type] || Code2;

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <div className="flex items-center justify-center w-5 h-5 rounded-full bg-muted text-muted-foreground flex-shrink-0">
            <Icon className="w-3 h-3" />
          </div>
        </TooltipTrigger>
        <TooltipContent side="top" className="text-xs uppercase">
          {type}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

export function TimeDisplay({ date }: { date: string }) {
  const dateObj = new Date(date);
  const relative = formatDistanceToNow(dateObj, {
    addSuffix: true,
    locale: zhCN,
  });
  const absolute = format(dateObj, "yyyy-MM-dd HH:mm:ss");

  return (
    <TooltipProvider>
      <Tooltip delayDuration={300}>
        <TooltipTrigger asChild>
          <span className="text-[10px] text-muted-foreground/60 ml-auto cursor-default hover:text-muted-foreground transition-colors hidden sm:inline-block">
            {relative}
          </span>
        </TooltipTrigger>
        <TooltipContent side="top" className="text-xs">
          {absolute}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
