"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { UIMessage } from "ai";
import { useSupabaseBrowser } from "mtmsdk/supabase/context";
import type { DBChatMessage } from "mtmsdk/types/contracts";
import type { Json } from "mtmsdk/types/database.types";
import { useEffect, useMemo } from "react";
import { toast } from "sonner";

interface useMtAgentChatProps {
  sessionId: string;
}

export const useMtAgentChat = ({ sessionId }: useMtAgentChatProps) => {
  const sb = useSupabaseBrowser();
  const queryClient = useQueryClient();
  const queryKey = ["chat_messages", sessionId];

  // 1. 获取消息列表
  const chatMessagesQuery = useQuery({
    queryKey: queryKey,
    queryFn: async () => {
      const { data, error } = await sb.rpc("chat_message_list", {
        p_chat_id: sessionId,
      });
      if (error) throw new Error(error.message);
      return data;
    },
  });

  // 1.1 Realtime 消息同步
  useEffect(() => {
    const channel = sb
      .channel(`chat_messages:${sessionId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "chat_messages",
          filter: `chat_id=eq.${sessionId}`,
        },
        () => {
          queryClient.invalidateQueries({ queryKey });
        },
      )
      .subscribe();

    return () => {
      sb.removeChannel(channel);
    };
  }, [sb, sessionId, queryClient, queryKey]);

  // 2. 处理用户输入
  const submitMutation = useMutation({
    mutationFn: async (userInput: UIMessage) => {
      console.log("submitMutation", userInput);
      // 通过调用自定义的数据库函数统一处理用户输入的消息. 这样 这个函数可以内部仅限必要的任务调用, 这样前端就不用处理复制的数据流程和交互逻辑.
      // 客户端只要拉取 chat_messages 的最新数据即可, 其余一切都基于后台进行.
      const { error: errorInsertUserMessage } = await sb.rpc("chat_message_batch_upsert", {
        p_chat_id: sessionId,
        p_data: userInput as unknown as Json,
      });
      if (errorInsertUserMessage) {
        console.log("errorInsertUserMessage", errorInsertUserMessage);
      }
      return true;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKey });
    },
    onError: (err) => {
      toast.error(err.message);
    },
  });

  // 3. 数据转换: DB Format -> UI Format
  const uiMessages = useMemo((): UIMessage[] => {
    const dbData = (chatMessagesQuery.data || []) as DBChatMessage[];
    return dbData.map((msg): UIMessage => {
      console.log("msg.grounding_metadata", msg.grounding_metadata);
      return {
        id: msg.id,
        role: msg.role as UIMessage["role"],
        parts: msg.parts as unknown as UIMessage["parts"],
        metadata: {
          // google 搜索结果, 对于 adk 中的 google search grounding tool
          // 具体说,就是本次答复的引用源.
          grounding_metadata: msg.grounding_metadata,
        },
      };
    });
  }, [chatMessagesQuery.data]);

  return {
    messages: uiMessages,
    isLoading: chatMessagesQuery.isLoading,
    isSending: submitMutation.isPending,
    handlerUserInput: (msg: UIMessage) => {
      console.log("用户输入了聊天消息", msg);
      submitMutation.mutate(msg);
    },
    state: {},
  };
};
