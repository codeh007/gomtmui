"use client";

import { useInfiniteQuery, useQueryClient } from "@tanstack/react-query";
import { Bell, CheckCheck, Loader2 } from "lucide-react";
import { useSupabaseBrowser } from "mtmsdk/supabase/context";
import { useRpcMutation } from "mtmsdk/supabase/use-sb-query/use-rpc-mutation";
import { Button } from "mtxuilib/ui/button";
import { ScrollArea } from "mtxuilib/ui/scroll-area";
import { Tabs, TabsList, TabsTrigger } from "mtxuilib/ui/tabs";
import { useMemo, useState } from "react";
import { z } from "zod";
import { NotificationItem } from "./NotificationItem";
import { invalidateNotificationQueries, notificationKeys } from "./notification-query";
import type { UserNotificationRecord } from "./schemas";
import { UserNotificationRecordSchema } from "./schemas";

interface NotificationListProps {
  onAction?: (notification: UserNotificationRecord) => void;
  enabled?: boolean;
}

export function NotificationList({ onAction, enabled = true }: NotificationListProps) {
  const [filter, setFilter] = useState<"all" | "unread">("unread");
  const queryClient = useQueryClient();
  const supabase = useSupabaseBrowser();

  const fetchNotifications = async ({ pageParam }: { pageParam?: string }) => {
    const { data, error } = await supabase.rpc("notification_list", {
      p_limit: 20,
      p_cursor: pageParam ?? undefined,
      p_unread_only: filter === "unread",
      p_include_dismissed: false,
    });

    if (error) throw error;

    return z.array(UserNotificationRecordSchema).parse(data || []);
  };

  const { data, isLoading, error, fetchNextPage, hasNextPage, isFetchingNextPage } = useInfiniteQuery({
    queryKey: notificationKeys.list(filter),
    queryFn: fetchNotifications,
    enabled,
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (lastPage) => {
      if (!lastPage || lastPage.length < 20) return undefined;
      return lastPage[lastPage.length - 1].id;
    },
  });

  const notifications = useMemo(() => {
    return data?.pages.flat() || [];
  }, [data]);

  const markReadMutation = useRpcMutation("notification_mark_read", {
    onSuccess: () => {
      invalidateNotificationQueries(queryClient);
    },
  });

  const dismissMutation = useRpcMutation("notification_dismiss", {
    onSuccess: () => {
      invalidateNotificationQueries(queryClient);
    },
  });

  const handleMarkRead = (id: string) => {
    markReadMutation.mutate({ p_id: id, p_mark_all: false });
  };

  const handleMarkAllRead = () => {
    markReadMutation.mutate({ p_id: undefined, p_mark_all: true });
  };

  const handleDismiss = (id: string) => {
    dismissMutation.mutate({ p_id: id });
  };

  const unreadCount = notifications.filter((n) => !n.is_read).length ?? 0;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-40">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center h-40 text-muted-foreground">
        <p className="text-sm">加载通知失败</p>
        <p className="text-xs">{error.message}</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      {/* 工具栏 */}
      <div className="flex items-center justify-between px-4 py-2 border-b">
        <Tabs value={filter} onValueChange={(v) => setFilter(v as "all" | "unread")} className="w-auto">
          <TabsList className="h-8">
            <TabsTrigger value="unread" className="text-xs px-2 h-6">
              未读 {unreadCount > 0 && `(${unreadCount})`}
            </TabsTrigger>
            <TabsTrigger value="all" className="text-xs px-2 h-6">
              全部
            </TabsTrigger>
          </TabsList>
        </Tabs>

        <div className="flex gap-2">
          {notifications.some((n) => !n.is_read) && (
            <Button
              variant="ghost"
              size="sm"
              className="h-7 text-xs"
              onClick={handleMarkAllRead}
              disabled={markReadMutation.isPending}
            >
              <CheckCheck className="h-3 w-3 mr-1" />
              全部标记已读
            </Button>
          )}
        </div>
      </div>

      {/* 通知列表 */}
      <ScrollArea className="flex-1">
        <div className="p-2 space-y-1">
          {notifications.length > 0 ? (
            <>
              {notifications.map((notification) => (
                <NotificationItem
                  key={notification.id}
                  notification={notification}
                  onMarkRead={handleMarkRead}
                  onDismiss={handleDismiss}
                  onAction={onAction}
                />
              ))}

              {hasNextPage && (
                <div className="py-2 flex justify-center">
                  <Button variant="ghost" size="sm" onClick={() => fetchNextPage()} disabled={isFetchingNextPage}>
                    {isFetchingNextPage ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        加载中...
                      </>
                    ) : (
                      "加载更多"
                    )}
                  </Button>
                </div>
              )}
            </>
          ) : (
            <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
              <Bell className="h-10 w-10 mb-3 opacity-30" />
              <p className="text-sm">暂无通知</p>
              <p className="text-xs mt-1">{filter === "unread" ? "没有未读通知" : "您的通知将显示在这里"}</p>
            </div>
          )}
        </div>
      </ScrollArea>
    </div>
  );
}
