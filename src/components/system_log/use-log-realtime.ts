import { useQueryClient } from "@tanstack/react-query";
import { useSupabaseBrowser } from "mtmsdk/supabase/context";
import { getRpcQueryKey } from "mtmsdk/supabase/use-sb-query/use-rpc-query";
import { useEffect } from "react";

const LOG_TABLES = ["user_logs", "sys_logs"] as const;

export function useLogRealtime(rpcName: string) {
  const sb = useSupabaseBrowser();
  const queryClient = useQueryClient();

  useEffect(() => {
    const channels = LOG_TABLES.map((tableName) =>
      sb
        .channel(`${tableName}_realtime`)
        .on("postgres_changes", { event: "INSERT", schema: "public", table: tableName }, () => {
          void queryClient.invalidateQueries({
            queryKey: getRpcQueryKey(rpcName),
          });
        })
        .subscribe(),
    );

    return () => {
      for (const channel of channels) {
        void sb.removeChannel(channel);
      }
    };
  }, [sb, queryClient, rpcName]);
}
