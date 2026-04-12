import { format, formatDistanceToNow } from "date-fns";
import { zhCN } from "date-fns/locale";
import { Check, ChevronDown, ChevronUp, Copy } from "lucide-react";
import { cn } from "mtxuilib/lib/utils";
import { Badge } from "mtxuilib/ui/badge";
import { Button } from "mtxuilib/ui/button";
import { Item, ItemContent, ItemDescription } from "mtxuilib/ui/item";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "mtxuilib/ui/tooltip";
import { useState } from "react";

/**
 * 通用的日志时间显示组件
 */
export function LogTimeDisplay({ date }: { date: string }) {
  const dateObj = new Date(date);
  const relative = formatDistanceToNow(dateObj, { addSuffix: true, locale: zhCN });
  const absolute = format(dateObj, "yyyy-MM-dd HH:mm:ss");

  return (
    <TooltipProvider>
      <Tooltip delayDuration={300}>
        <TooltipTrigger asChild>
          <span className="text-[10px] text-muted-foreground/60 ml-auto cursor-default hover:text-muted-foreground transition-colors shrink-0">
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

/**
 * 统一日志等级徽章组件
 */
export function LogLevelBadge({ level }: { level: string | number | null | undefined }) {
  const normLevel = String(level ?? "info").toLowerCase();

  let variant: "destructive" | "secondary" | "outline" | "default" = "outline";
  let label = "Info";
  let className = "text-muted-foreground border-muted-foreground/30";

  if (normLevel === "1" || normLevel === "error" || normLevel >= "500") {
    variant = "destructive";
    label = "Error";
    className = "border-destructive/50";
  } else if (normLevel === "2" || normLevel === "warn" || normLevel === "warning" || normLevel >= "400") {
    variant = "secondary";
    label = "Warn";
    className =
      "text-yellow-600 dark:text-yellow-400 bg-yellow-50 dark:bg-yellow-900/10 border-yellow-200 dark:border-yellow-800";
  } else if (normLevel >= "200" && normLevel < "400") {
    variant = "outline";
    label = "OK";
    className = "text-green-600 dark:text-green-400 border-green-200 dark:border-green-800/30";
  } else {
    variant = "outline";
    label = normLevel === "3" || normLevel === "info" ? "Info" : normLevel;
    className = "text-muted-foreground border-muted-foreground/30";
  }

  // 针对特定 HTTP 状态码特殊处理文本
  if (/^\d{3}$/.test(normLevel)) {
    label = normLevel;
  }

  return (
    <Badge
      variant={variant}
      className={cn("capitalize font-normal text-[10px] px-1.5 py-0 h-4 shadow-none", className)}
    >
      {label}
    </Badge>
  );
}

/**
 * 日志 JSON 详情组件，支持内联展开和复制
 */
export function LogJsonDetails({ meta, defaultExpanded = false }: { meta: any; defaultExpanded?: boolean }) {
  const [isExpanded, setIsExpanded] = useState(defaultExpanded);
  const [copied, setCopied] = useState(false);
  const hasMeta = meta && Object.keys(meta).length > 0;

  const handleCopy = (e: React.MouseEvent) => {
    e.stopPropagation();
    navigator.clipboard.writeText(JSON.stringify(meta, null, 2));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (!hasMeta) return null;

  return (
    // biome-ignore lint/a11y/noStaticElementInteractions: presentation only
    <div className="mt-2 w-full" onClick={(e) => e.stopPropagation()}>
      <div className="flex items-center gap-2">
        <Button
          variant="ghost"
          size="sm"
          className="h-6 px-2 text-[10px] text-muted-foreground hover:text-foreground"
          onClick={() => setIsExpanded(!isExpanded)}
        >
          {isExpanded ? <ChevronUp className="w-3 h-3 mr-1" /> : <ChevronDown className="w-3 h-3 mr-1" />}
          {isExpanded ? "收起详情" : "查看详情"}
        </Button>

        <Button
          variant="ghost"
          size="sm"
          className="h-6 px-2 text-[10px] text-muted-foreground hover:text-foreground ml-auto"
          onClick={handleCopy}
        >
          {copied ? <Check className="w-3 h-3 mr-1" /> : <Copy className="w-3 h-3 mr-1" />}
          {copied ? "已复制" : "复制JSON"}
        </Button>
      </div>

      {isExpanded && (
        <div className="mt-2 relative group">
          <pre className="text-[10px] font-mono bg-muted/50 p-3 rounded-md overflow-x-auto max-h-[400px] whitespace-pre-wrap break-all">
            {JSON.stringify(meta, null, 2)}
          </pre>
        </div>
      )}
    </div>
  );
}

export interface UnifiedLogItemProps {
  /** 自定义水平头部左侧组件数组 */
  headerLeft?: React.ReactNode[];
  /** 自定义头部右侧组件 (默认是相对于最后的时间) */
  headerRight?: React.ReactNode;
  /** 日志时间戳 */
  timestamp?: string | null;
  /** 主要内容 / 文本 / 路径 */
  content: React.ReactNode;
  /** 附加行内容，例如 ResourceType, 耗时, 数据大小等 */
  footer?: React.ReactNode;
  /** 额外的完整区块，例如 JSON Details 或者侧边抽屉触发器 */
  children?: React.ReactNode;
  /** 列表项点击事件 */
  onClick?: () => void;
  /** 列表项是否选中状态 */
  selected?: boolean;
}

/**
 * 统一共享的 Log List Item 组件，支持不同的日志场景如 system/user/traffic。
 */
export function UnifiedLogItem({
  headerLeft = [],
  headerRight,
  timestamp,
  content,
  footer,
  children,
  onClick,
  selected,
}: UnifiedLogItemProps) {
  return (
    <Item
      className={cn(
        "py-3 items-start transition-colors",
        onClick && "cursor-pointer hover:bg-black/[0.02] dark:hover:bg-white/[0.02]",
        selected && "bg-black/[0.04] dark:bg-white/[0.04]",
      )}
      onClick={onClick}
    >
      <ItemContent className="gap-1.5 min-w-0">
        <div className="flex items-center gap-2 mb-0.5 flex-wrap">
          {headerLeft?.map((node, i) => (
            <span key={i} className="flex">
              {node}
            </span>
          ))}

          {headerRight ? headerRight : timestamp ? <LogTimeDisplay date={timestamp} /> : null}
        </div>

        <ItemDescription className="text-foreground/90 text-sm mt-1 break-all line-clamp-2">{content}</ItemDescription>

        {footer && (
          <div className="text-[10px] text-muted-foreground flex items-center gap-2 mt-1 flex-wrap">{footer}</div>
        )}

        {children}
      </ItemContent>
    </Item>
  );
}
