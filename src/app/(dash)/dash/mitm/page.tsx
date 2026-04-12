"use client";

import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { RefreshCw, WifiOff } from "lucide-react";
import { useRpcQuery } from "mtmsdk/supabase/use-sb-query/use-rpc-query";
import { type ServerInstanceGetReturns, serverInstanceGetResultSchema, type TrafficLog } from "mtmsdk/types/contracts";
import { Button } from "mtxuilib/ui/button";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { z } from "zod";
import { DashContent, DashHeaders } from "@/components/dash-layout";
import { MitmInstanceSelect } from "@/components/mitm/mitm-instance-select";
import { MitmToolbar } from "@/components/mitm/mitm-toolbar";
import { MitmTrafficDataLayer } from "@/components/mitm/mitm-traffic-data-layer";
import {
  getServerPublicUrl,
  getServerStateStatus,
  type InstanceConfig,
  type SidecarDatabase,
} from "@/components/mitm/shared";
import { useServerInstanceListInfinite } from "@/components/server-instance/hooks";
import { useCurrentUserRole } from "@/hooks/use-current-user-role";

export default function InstanceMitmPage() {
  const { isAdmin } = useCurrentUserRole();
  const [selectedLog, setSelectedLog] = useState<TrafficLog | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedServerId, setSelectedServerId] = useState("");
  const [mitmClient, setMitmClient] = useState<SupabaseClient<SidecarDatabase> | null>(null);
  const [isLive, setIsLive] = useState(true);
  const [useInternal, setUseInternal] = useState(false);
  const [configOpen, setConfigOpen] = useState(false);

  const serverListQuery = useServerInstanceListInfinite({
    pageSize: 100,
  });
  const serverInstances = useMemo(() => serverListQuery.data?.pages.flat() ?? [], [serverListQuery.data]);

  useEffect(() => {
    if (serverInstances.length === 0) {
      if (selectedServerId) {
        setSelectedServerId("");
      }
      return;
    }

    const hasSelected = serverInstances.some((item) => item.id === selectedServerId);
    if (hasSelected) return;

    const preferred = serverInstances.find((item) => getServerStateStatus(item) === "ready") ?? serverInstances[0];
    if (preferred?.id) {
      setSelectedServerId(preferred.id);
    }
  }, [serverInstances, selectedServerId]);

  const resourceQuery = useRpcQuery(
    "server_get",
    { p_server_id: selectedServerId || undefined },
    {
      enabled: !!selectedServerId,
      schema: z.array(serverInstanceGetResultSchema),
    },
  );
  const resourceRows = resourceQuery.data?.filter(isServerInstanceGetReturns) ?? [];
  const resource = resourceRows[0] ?? null;

  useEffect(() => {
    if (resource?.state) {
      const state = resource.state as unknown as InstanceConfig;
      if (state.sidecar_db_url && state.sidecar_db_key) {
        try {
          const client = createClient<SidecarDatabase>(state.sidecar_db_url, state.sidecar_db_key);
          setMitmClient(client);
          setUseInternal(false);
        } catch (e) {
          console.error("Failed to init sidecar client", e);
          toast.error("Invalid Sidecar DB Config, falling back to internal");
          setUseInternal(true);
        }
      } else {
        setMitmClient(null);
        setUseInternal(true);
      }
      return;
    }

    setMitmClient(null);
    setUseInternal(false);
  }, [resource]);

  const endpoint = getServerPublicUrl(resource);

  const status = getServerStateStatus(resource);
  const isOffline = status !== "ready";

  if (useInternal && isOffline) {
    return (
      <DashContent className="h-full flex flex-col items-center justify-center p-8">
        <div className="text-center max-w-md">
          <WifiOff className="w-16 h-16 text-slate-300 mx-auto mb-4" />
          <h2 className="text-xl font-semibold mb-2">服务实例已离线</h2>
          <p className="text-muted-foreground mb-6">您目前处于内部存储模式，需要服务实例在线才能查看流量日志。</p>
          {isAdmin && (
            <Button asChild>
              <a href="/dash/instances">前往服务实例</a>
            </Button>
          )}
        </div>
      </DashContent>
    );
  }

  if (serverListQuery.isLoading || (selectedServerId && resourceQuery.isLoading)) {
    return (
      <DashContent className="h-full flex flex-col items-center justify-center p-8">
        <div className="text-center max-w-md">
          <RefreshCw className="w-8 h-8 text-slate-400 mx-auto mb-4 animate-spin" />
          <p className="text-muted-foreground">正在加载 MITM 实例...</p>
        </div>
      </DashContent>
    );
  }

  if (serverInstances.length === 0) {
    return (
      <DashContent className="h-full flex flex-col items-center justify-center p-8">
        <div className="text-center max-w-md space-y-3">
          <WifiOff className="w-16 h-16 text-slate-300 mx-auto" />
          <h2 className="text-xl font-semibold">暂无可用服务实例</h2>
          <p className="text-muted-foreground">请先创建并启动一个服务实例，再进入流量监控页面。</p>
          {isAdmin && (
            <Button asChild>
              <a href="/dash/instances">前往服务实例</a>
            </Button>
          )}
        </div>
      </DashContent>
    );
  }

  if (!resource) {
    return (
      <DashContent className="h-full flex flex-col items-center justify-center p-8">
        <div className="text-center max-w-md space-y-3">
          <WifiOff className="w-16 h-16 text-slate-300 mx-auto" />
          <h2 className="text-xl font-semibold">未找到对应服务实例</h2>
          <p className="text-muted-foreground">当前选择的实例详情加载失败，请重新选择一个实例。</p>
        </div>
      </DashContent>
    );
  }

  return (
    <DashContent className="h-full flex flex-col p-0" innerClassName="p-0 h-full flex flex-col">
      <MitmTrafficDataLayer
        resource={resource}
        mitmClient={mitmClient}
        useInternal={useInternal}
        isLive={isLive}
        searchTerm={searchTerm}
        selectedLog={selectedLog}
        onSelectLog={setSelectedLog}
        onClearSelection={() => setSelectedLog(null)}
      >
        {({ onClear }) => (
          <DashHeaders borderBottom className="px-3 sm:px-6 py-2 h-auto">
            <div className="flex items-center justify-between w-full gap-2">
              <MitmInstanceSelect
                instances={serverInstances}
                selectedServerId={selectedServerId}
                onSelectServer={setSelectedServerId}
                useInternal={useInternal}
              />
              <MitmToolbar
                searchTerm={searchTerm}
                onSearchTermChange={setSearchTerm}
                isLive={isLive}
                onToggleLive={() => setIsLive(!isLive)}
                onClear={onClear}
                configOpen={configOpen}
                onConfigOpenChange={setConfigOpen}
                resource={resource}
                endpoint={endpoint}
              />
            </div>
          </DashHeaders>
        )}
      </MitmTrafficDataLayer>
    </DashContent>
  );
}

function isServerInstanceGetReturns(value: unknown): value is ServerInstanceGetReturns {
  return typeof value === "object" && value !== null && "state" in value;
}
