import type { QueryClient } from "@tanstack/react-query";
import { getRpcQueryKey } from "mtmsdk/supabase/use-sb-query/use-rpc-query";

export const notificationKeys = {
  listPrefix: () => ["notification_list"] as const,
  list: (filter: "all" | "unread") => [...notificationKeys.listPrefix(), filter] as const,
  count: () => getRpcQueryKey("notification_count"),
};

export function invalidateNotificationQueries(queryClient: QueryClient) {
  void queryClient.invalidateQueries({ queryKey: notificationKeys.listPrefix() });
  void queryClient.invalidateQueries({ queryKey: notificationKeys.count() });
}
