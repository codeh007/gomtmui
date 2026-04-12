"use client";

import { Activity, ListFilter, Search } from "lucide-react";
import { useRpcQuery } from "mtmsdk/supabase/use-sb-query/use-rpc-query";
import { Button } from "mtxuilib/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "mtxuilib/ui/card";
import { Input } from "mtxuilib/ui/input";
import { ItemGroup } from "mtxuilib/ui/item";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "mtxuilib/ui/select";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { z } from "zod";

import { LogListItem } from "./log-list-item";
import { useLogRealtime } from "./use-log-realtime";

type LogSource = "all" | "user" | "system";
type LogScope = "mine" | "all";

const LOG_SOURCES: readonly LogSource[] = ["all", "user", "system"];
const LOG_SCOPES: readonly LogScope[] = ["mine", "all"];

const parseLogSource = (value: string | null): LogSource | null => {
  if (!value || !LOG_SOURCES.includes(value as LogSource)) {
    return null;
  }
  return value as LogSource;
};

const parseLogScope = (value: string | null): LogScope | null => {
  if (!value || !LOG_SCOPES.includes(value as LogScope)) {
    return null;
  }
  return value as LogScope;
};

const UnifiedLogSchema = z.object({
  id: z.string(),
  source: z.enum(["user", "system"]),
  created_at: z.string().nullable(),
  event_type: z.string().nullable(),
  level: z.string().nullable(),
  module: z.string().nullable(),
  content: z.string().nullable(),
  meta: z.any().nullable(),
  resource_type: z.string().nullable(),
  resource_id: z.string().nullable(),
  user_id: z.string().nullable(),
});

type UnifiedLog = z.infer<typeof UnifiedLogSchema>;

export function SystemLogView() {
  const router = useRouter();
  const pathname = usePathname() ?? "";
  const searchParams = useSearchParams();
  const [source, setSource] = useState<LogSource>("all");
  const [scope, setScope] = useState<LogScope>("mine");
  const [module, setModule] = useState<string>("all");
  const [levelMax, setLevelMax] = useState<string>("info");
  const [eventType, setEventType] = useState<string>("");
  const [limit, setLimit] = useState(50);

  useEffect(() => {
    const sourceFromQuery = parseLogSource(searchParams?.get("source") ?? null);
    const scopeFromQuery = parseLogScope(searchParams?.get("scope") ?? null);

    if (sourceFromQuery) {
      setSource((prev) => (prev === sourceFromQuery ? prev : sourceFromQuery));
    }

    if (scopeFromQuery) {
      setScope((prev) => (prev === scopeFromQuery ? prev : scopeFromQuery));
    }
  }, [pathname, router, searchParams]);

  useEffect(() => {
    const currentParams = new URLSearchParams(searchParams?.toString() ?? "");
    const nextParams = new URLSearchParams(currentParams.toString());

    if (source === "all") {
      nextParams.delete("source");
    } else {
      nextParams.set("source", source);
    }

    if (scope === "mine") {
      nextParams.delete("scope");
    } else {
      nextParams.set("scope", scope);
    }

    const currentQuery = currentParams.toString();
    const nextQuery = nextParams.toString();

    if (currentQuery === nextQuery) {
      return;
    }

    router.replace(nextQuery ? `${pathname}?${nextQuery}` : pathname);
  }, [pathname, router, scope, searchParams, source]);

  const permissionQuery = useRpcQuery(
    "has_permission",
    {
      p_resource: "user_logs",
      p_action: "read_all",
    },
    {
      schema: z.boolean(),
    },
  );
  const canReadAll = permissionQuery.data ?? false;

  useEffect(() => {
    if (!canReadAll && scope === "all") {
      setScope("mine");
    }
  }, [canReadAll, scope]);

  const query = useRpcQuery(
    "log_list_unified",
    {
      p_source: source,
      p_scope: scope,
      p_limit: limit,
      p_level_max: levelMax,
      p_module: module === "all" ? undefined : module,
      p_event_type: eventType === "" ? undefined : eventType,
    },
    {
      schema: z.array(UnifiedLogSchema),
    },
  );

  useLogRealtime("log_list_unified");

  const logs = query.data || [];

  const listItems = useMemo(
    () =>
      logs.map((log) => {
        if (log.source === "system") {
          return {
            key: `system-${log.id}`,
            type: "system" as const,
            log: {
              ...log,
              text: log.content,
            },
          };
        }

        return {
          key: `user-${log.id}`,
          type: "user" as const,
          log,
        };
      }),
    [logs],
  );

  const handleFilterChanged = (cb: () => void) => {
    cb();
    setLimit(50);
  };

  return (
    <div className="space-y-4">
      <Card className="border-none shadow-none text-muted-foreground bg-muted/20">
        <CardHeader className="py-3 px-4">
          <div className="flex flex-wrap items-center gap-6">
            <CardTitle className="text-sm font-medium flex items-center gap-2 text-foreground">
              <Activity className="w-4 h-4 text-muted-foreground" />
              统一日志视图
            </CardTitle>

            <div className="flex items-center gap-2">
              <span className="text-[10px] uppercase tracking-wider font-semibold">来源</span>
              <Select value={source} onValueChange={(v: LogSource) => handleFilterChanged(() => setSource(v))}>
                <SelectTrigger className="w-[110px] h-7 text-[11px] bg-background">
                  <SelectValue placeholder="Source" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">全部</SelectItem>
                  <SelectItem value="user">用户日志</SelectItem>
                  <SelectItem value="system">系统日志</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="flex items-center gap-2">
              <span className="text-[10px] uppercase tracking-wider font-semibold">作用域</span>
              <Select
                value={scope}
                onValueChange={(v: LogScope) => handleFilterChanged(() => setScope(v))}
                disabled={source === "system"}
              >
                <SelectTrigger className="w-[110px] h-7 text-[11px] bg-background">
                  <SelectValue placeholder="Scope" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="mine">仅我</SelectItem>
                  {canReadAll && <SelectItem value="all">全部用户</SelectItem>}
                </SelectContent>
              </Select>
            </div>

            <div className="flex items-center gap-2">
              <span className="text-[10px] uppercase tracking-wider font-semibold">模块</span>
              <Select value={module} onValueChange={(v) => handleFilterChanged(() => setModule(v))}>
                <SelectTrigger className="w-[110px] h-7 text-[11px] bg-background">
                  <SelectValue placeholder="Module" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">全部</SelectItem>
                  <SelectItem value="sys" className="text-[11px]">
                    System
                  </SelectItem>
                  <SelectItem value="tunnel" className="text-[11px]">
                    Tunnel
                  </SelectItem>
                  <SelectItem value="telegram" className="text-[11px]">
                    Telegram
                  </SelectItem>
                  <SelectItem value="outreach" className="text-[11px]">
                    Outreach
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="flex items-center gap-2">
              <span className="text-[10px] uppercase tracking-wider font-semibold">级别</span>
              <Select value={levelMax} onValueChange={(v) => handleFilterChanged(() => setLevelMax(v))}>
                <SelectTrigger className="w-[110px] h-7 text-[11px] bg-background">
                  <SelectValue placeholder="Level" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="info" className="text-[11px]">
                    Info & Above
                  </SelectItem>
                  <SelectItem value="warn" className="text-[11px]">
                    Warn & Error
                  </SelectItem>
                  <SelectItem value="error" className="text-[11px]">
                    Error Only
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="flex items-center gap-2 flex-1 min-w-[200px]">
              <ListFilter className="w-3.5 h-3.5" />
              <Input
                placeholder="搜索事件类型..."
                className="h-7 text-[11px] bg-background"
                value={eventType}
                onChange={(e) => handleFilterChanged(() => setEventType(e.target.value))}
              />
              <Search className="w-3.5 h-3.5 text-muted-foreground" />
            </div>
          </div>
        </CardHeader>
      </Card>

      {logs.length === 0 ? (
        <div className="text-center py-10 text-muted-foreground text-sm">暂无日志</div>
      ) : (
        <>
          <Card className="border shadow-sm">
            <CardContent className="p-0">
              <ItemGroup>
                {listItems.map((item) => (
                  <LogListItem key={item.key} log={item.log as UnifiedLog} type={item.type} />
                ))}
              </ItemGroup>
            </CardContent>
          </Card>

          {logs.length >= limit && (
            <div className="flex justify-center pb-4">
              <Button variant="ghost" size="sm" onClick={() => setLimit(limit + 50)}>
                加载更多
              </Button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
