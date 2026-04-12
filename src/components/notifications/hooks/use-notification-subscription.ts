"use client";

import type { RealtimePostgresChangesPayload } from "@supabase/supabase-js";
import { useQueryClient } from "@tanstack/react-query";
import { useSupabaseBrowser } from "mtmsdk/supabase/context";
import { useEffect } from "react";
import { toast } from "sonner";
import { invalidateNotificationQueries } from "../notification-query";

export function useNotificationSubscription() {
  const sb = useSupabaseBrowser();
  const queryClient = useQueryClient();

  useEffect(() => {
    const channel = sb
      .channel("notification_changes")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "user_notifications",
        },
        (
          payload: RealtimePostgresChangesPayload<{
            title?: string;
            message?: string;
            notification_type?: string;
            priority?: string;
          }>,
        ) => {
          if (payload.eventType === "INSERT" && payload.new) {
            const record = payload.new;
            if (record.title) {
              if (record.notification_type === "error" || record.priority === "urgent") {
                toast.error(record.title, { description: record.message });
              } else if (record.notification_type === "warning") {
                toast.warning(record.title, { description: record.message });
              } else {
                toast.info(record.title, { description: record.message });
              }
            }
          }
          invalidateNotificationQueries(queryClient);
        },
      )
      .subscribe();

    return () => {
      void sb.removeChannel(channel);
    };
  }, [sb, queryClient]);
}
