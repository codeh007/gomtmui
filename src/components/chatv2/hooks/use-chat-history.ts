"use client";

import type { RealtimePostgresChangesPayload } from "@supabase/supabase-js";
import { useQueryClient } from "@tanstack/react-query";
import { useSupabaseBrowser } from "mtmsdk/supabase/context";
import { getRpcQueryKey, useRpcQuery } from "mtmsdk/supabase/use-sb-query/use-rpc-query";
import type { ChatRow } from "mtmsdk/types/contracts";
import { publicChatListReturnsSchema } from "mtmsdk/types/database.schemas";
import { useEffect, useMemo } from "react";

type ChatGroup = {
  groupLabel: string;
  items: ChatRow[];
};

export interface useChatHistoryProps {
  agentId: string;
}

export const useChatHistory = ({ agentId }: useChatHistoryProps) => {
  const sb = useSupabaseBrowser();
  const queryClient = useQueryClient();
  const queryKey = useMemo(() => getRpcQueryKey("chat_list"), []);
  const { data: rawChats } = useRpcQuery(
    "chat_list",
    { p_agent_id: agentId },
    {
      schema: publicChatListReturnsSchema,
    },
  );
  const chats = rawChats ?? [];

  useEffect(() => {
    const channel = sb.channel(`chats_list_updates:${agentId}`);
    channel
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "chats",
        },
        (payload: RealtimePostgresChangesPayload<ChatRow>) => {
          const changedRow = payload.eventType === "DELETE" ? payload.old : payload.new;
          if ((changedRow as ChatRow | null)?.agent_id !== agentId) {
            return;
          }
          void queryClient.invalidateQueries({ queryKey });
        },
      )
      .subscribe();

    return () => {
      sb.removeChannel(channel);
    };
  }, [agentId, queryClient, queryKey, sb]);

  const groupedChatHistory = useMemo(() => {
    if (!chats.length) return [];

    const getItemDate = (item: ChatRow) => new Date(item.updated_at || item.created_at);
    const sortedData = [...chats].sort((a, b) => getItemDate(b).getTime() - getItemDate(a).getTime());

    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    const last7Days = new Date(today);
    last7Days.setDate(last7Days.getDate() - 7);

    const last30Days = new Date(today);
    last30Days.setDate(last30Days.getDate() - 30);

    const groups: Record<string, ChatGroup> = {
      today: { groupLabel: "今天", items: [] },
      yesterday: { groupLabel: "昨天", items: [] },
      previous7Days: { groupLabel: "过去 7 天", items: [] },
      previous30Days: { groupLabel: "过去 30 天", items: [] },
    };

    const olderGroupsMap = new Map<string, ChatGroup>();

    for (const item of sortedData) {
      const itemDate = getItemDate(item);
      const itemDay = new Date(itemDate.getFullYear(), itemDate.getMonth(), itemDate.getDate());
      const itemTime = itemDay.getTime();
      const todayTime = today.getTime();
      const yesterdayTime = yesterday.getTime();

      if (itemTime >= todayTime) {
        groups.today.items.push(item);
      } else if (itemTime === yesterdayTime) {
        groups.yesterday.items.push(item);
      } else if (itemDay > last7Days) {
        groups.previous7Days.items.push(item);
      } else if (itemDay > last30Days) {
        groups.previous30Days.items.push(item);
      } else {
        const monthKey = `${itemDate.getFullYear()}-${itemDate.getMonth()}`;
        const groupLabel = `${itemDate.getFullYear()}年 ${itemDate.getMonth() + 1}月`;

        if (!olderGroupsMap.has(monthKey)) {
          olderGroupsMap.set(monthKey, { groupLabel, items: [] });
        }
        olderGroupsMap.get(monthKey)?.items.push(item);
      }
    }

    return [
      groups.today,
      groups.yesterday,
      groups.previous7Days,
      groups.previous30Days,
      ...Array.from(olderGroupsMap.values()),
    ].filter((group) => group.items.length > 0);
  }, [chats]);

  return groupedChatHistory;
};
