"use client";

import type { SupabaseClient } from "@supabase/supabase-js";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import type { ServerInstanceGetReturns, TrafficLog, TrafficLogRow } from "mtmsdk/types/contracts";
import type { ReactNode } from "react";
import { useEffect, useMemo } from "react";
import { toast } from "sonner";
import { TrafficDetails } from "@/components/mitm/traffic-details";
import { TrafficList } from "@/components/mitm/traffic-list";
import type { InstanceConfig, SidecarDatabase } from "./shared";
import { mapRowToTrafficLog } from "./shared";

interface MitmTrafficDataLayerProps {
  resource: ServerInstanceGetReturns;
  mitmClient: SupabaseClient<SidecarDatabase> | null;
  useInternal: boolean;
  isLive: boolean;
  searchTerm: string;
  selectedLog: TrafficLog | null;
  onSelectLog: (log: TrafficLog) => void;
  onClearSelection: () => void;
  children: (props: { onClear: () => Promise<void> }) => ReactNode;
}

export function MitmTrafficDataLayer({
  resource,
  mitmClient,
  useInternal,
  isLive,
  searchTerm,
  selectedLog,
  onSelectLog,
  onClearSelection,
  children,
}: MitmTrafficDataLayerProps) {
  const queryClient = useQueryClient();
  const serverId = resource.id ?? "unknown";
  const queryKey = useMemo(
    () => ["traffic_logs", serverId, !!mitmClient, useInternal],
    [serverId, !!mitmClient, useInternal],
  );

  const trafficQuery = useQuery({
    queryKey,
    queryFn: async () => {
      if (mitmClient) {
        const { data, error } = await mitmClient
          .from("traffic_logs")
          .select("*")
          .order("created_at", { ascending: false })
          .limit(100);

        if (error) throw error;
        return (data || []).map(mapRowToTrafficLog);
      }

      if (useInternal) {
        const state = resource.state as unknown as InstanceConfig;
        const endpoint = state?.public_url;
        if (!endpoint) return [];

        const baseUrl = endpoint.replace(/\/$/, "");
        const res = await fetch(`${baseUrl}/api/mproxy/logs?limit=100`);
        if (res.ok) {
          const data = await res.json();
          if (Array.isArray(data)) {
            return data.map(mapRowToTrafficLog);
          }
        }
      }

      return [];
    },
    enabled: !!resource,
    refetchInterval: useInternal && isLive ? 3000 : false,
  });

  const trafficLogs = trafficQuery.data || [];

  useEffect(() => {
    if (!isLive || !mitmClient) return;

    const channel = mitmClient
      .channel("traffic_monitoring")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "traffic_logs" }, (payload) => {
        const newLog = mapRowToTrafficLog(payload.new as TrafficLogRow);
        queryClient.setQueryData(queryKey, (old: TrafficLog[] | undefined) => {
          const updated = [newLog, ...(old || [])];
          return updated.slice(0, 1000);
        });
      })
      .subscribe();

    return () => {
      mitmClient.removeChannel(channel);
    };
  }, [isLive, mitmClient, queryClient, queryKey]);

  const filteredLogs = useMemo(
    () =>
      trafficLogs.filter(
        (log) =>
          log.host.toLowerCase().includes(searchTerm.toLowerCase()) ||
          log.path.toLowerCase().includes(searchTerm.toLowerCase()),
      ),
    [searchTerm, trafficLogs],
  );

  const handleClear = async () => {
    try {
      if (mitmClient) {
        const { error } = await mitmClient.from("traffic_logs").delete().neq("id", "0");
        if (error) throw error;
      } else if (useInternal) {
        const state = resource.state as unknown as InstanceConfig;
        const endpoint = state?.public_url;
        if (endpoint) {
          const baseUrl = endpoint.replace(/\/$/, "");
          const res = await fetch(`${baseUrl}/api/mproxy/logs`, {
            method: "DELETE",
          });
          if (!res.ok) {
            const txt = await res.text();
            throw new Error(txt || "Failed to clear logs via API");
          }
        }
      }

      queryClient.setQueryData(queryKey, []);
      onClearSelection();
      toast.success("已清空后端流量记录");
    } catch (e: unknown) {
      console.error("Failed to clear logs:", e);
      const msg = e instanceof Error ? e.message : "Unknown error";
      toast.error(`清空失败: ${msg}`);
    }
  };

  return (
    <>
      {children({ onClear: handleClear })}
      <div className="flex-1 overflow-hidden flex">
        <TrafficList logs={filteredLogs} selectedLogId={selectedLog?.id} onSelectLog={onSelectLog} />
      </div>
      <TrafficDetails log={selectedLog} open={!!selectedLog} onOpenChange={(open) => !open && onClearSelection()} />
    </>
  );
}
