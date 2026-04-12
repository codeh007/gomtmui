"use client";

import { useQueryClient } from "@tanstack/react-query";
import { useSupabaseBrowser } from "mtmsdk/supabase/context";
import { getRpcQueryKey } from "mtmsdk/supabase/use-sb-query/use-rpc-query";
import { useEffect } from "react";
import { toast } from "sonner";

export function RealtimeProvider({ children }: { children: React.ReactNode }) {
  const sb = useSupabaseBrowser();
  const queryClient = useQueryClient();

  useEffect(() => {
    // Global subscription for 'servers' table (原 workers 表)
    // This allows multiple components to benefit from real-time updates without creating multiple connections
    const channel = sb
      .channel("global-db-changes")
      .on("postgres_changes", { event: "*", schema: "public", table: "servers" }, () => {
        void queryClient.invalidateQueries({ queryKey: getRpcQueryKey("server_list_cursor") });
        void queryClient.invalidateQueries({ queryKey: getRpcQueryKey("server_get") });
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "cloud_accounts" }, () => {
        void queryClient.invalidateQueries({ queryKey: getRpcQueryKey("cloud_account_list_cursor") });
        void queryClient.invalidateQueries({ queryKey: getRpcQueryKey("cloud_account_get") });
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "ddl_requests" }, (payload) => {
        void queryClient.invalidateQueries({ queryKey: ["ddl_request_list"] });
        const newData = payload.new as any;
        const oldData = payload.old as any;

        if (newData?.id) {
          void queryClient.invalidateQueries({ queryKey: ["ddl_request_get", newData.id] });

          // Show notifications for status changes
          if (newData.status !== oldData?.status) {
            if (newData.status === "executed") {
              toast.success("DDL 执行成功", {
                description: `请求 ID: ${newData.id.slice(0, 8)} 已成功应用到数据库。`,
              });
            } else if (newData.status === "rejected") {
              toast.error("DDL 请求已拒绝", {
                description: newData.review_comment || "管理员拒绝了该变更请求。",
              });
            } else if (newData.status === "execution_failed") {
              toast.error("DDL 执行失败", {
                description: newData.execution_result || "执行过程中发生错误。",
              });
            } else if (newData.status === "pending_approval" && oldData?.status === "pending_validation") {
              toast.info("发现新 DDL 请求", {
                description: "Agent 提交的新 DDL 请求已通过预检，等待审批。",
              });
            }
          }
        }
      })
      .subscribe();

    return () => {
      void sb.removeChannel(channel);
    };
  }, [sb, queryClient]);

  return <>{children}</>;
}
