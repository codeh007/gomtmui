"use client";

import { formatDistanceToNow } from "date-fns";
import { zhCN } from "date-fns/locale";
import { AlertCircle, AlertTriangle, Check, CheckCircle, ExternalLink, Info, MessageSquare, X } from "lucide-react";
import { cn } from "mtxuilib/lib/utils";
import { Badge } from "mtxuilib/ui/badge";
import { Button } from "mtxuilib/ui/button";

import type { UserNotificationRecord } from "./schemas";
import { isActionRequiredNotification, isLinkNotification } from "./schemas";

interface NotificationItemProps {
  notification: UserNotificationRecord;
  onMarkRead?: (id: string) => void;
  onDismiss?: (id: string) => void;
  onAction?: (notification: UserNotificationRecord) => void;
}

function getNotificationIcon(type: string | null) {
  switch (type) {
    case "error":
      return { icon: AlertCircle, className: "text-destructive" };
    case "warning":
      return { icon: AlertTriangle, className: "text-yellow-500" };
    case "action_required":
      return { icon: MessageSquare, className: "text-blue-500" };
    case "info":
    default:
      return { icon: Info, className: "text-muted-foreground" };
  }
}

function getPriorityBadge(priority: string | null) {
  switch (priority) {
    case "urgent":
      return { variant: "destructive" as const, label: "紧急" };
    case "high":
      return { variant: "default" as const, label: "重要" };
    case "low":
      return { variant: "secondary" as const, label: "低优" };
    default:
      return null;
  }
}

export function NotificationItem({ notification, onMarkRead, onDismiss, onAction }: NotificationItemProps) {
  const { icon: Icon, className: iconClassName } = getNotificationIcon(notification.notification_type);
  const priorityBadge = getPriorityBadge(notification.priority);
  const isUnread = !notification.is_read;
  const isActionable = isActionRequiredNotification(notification);
  const isLink = isLinkNotification(notification);

  const timeAgo = notification.created_at
    ? formatDistanceToNow(new Date(notification.created_at), {
        addSuffix: true,
        locale: zhCN,
      })
    : "";

  return (
    <div
      role="button"
      tabIndex={0}
      className={cn(
        "group flex gap-3 p-3 rounded-lg transition-colors cursor-pointer hover:bg-accent/50",
        isUnread && "bg-accent/30",
        isActionable && "border-l-2 border-l-blue-500",
      )}
      onClick={() => {
        if ((isActionable || isLink) && onAction) {
          onAction(notification);
        } else if (isUnread && onMarkRead) {
          onMarkRead(notification.id);
        }
      }}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          if (isActionable && onAction) {
            onAction(notification);
          } else if (isUnread && onMarkRead) {
            onMarkRead(notification.id);
          }
        }
      }}
    >
      <div className={cn("shrink-0 mt-0.5", iconClassName)}>
        <Icon className="h-5 w-5" />
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <span
                className={cn("font-medium text-sm truncate", isUnread ? "text-foreground" : "text-muted-foreground")}
              >
                {notification.title}
              </span>
              {isLink && <ExternalLink className="h-3 w-3 text-muted-foreground" />}
              {priorityBadge && (
                <Badge variant={priorityBadge.variant} className="text-[10px] px-1 py-0">
                  {priorityBadge.label}
                </Badge>
              )}
              {isUnread && <span className="shrink-0 h-2 w-2 rounded-full bg-blue-500" />}
            </div>

            {notification.message && (
              <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{notification.message}</p>
            )}

            <p className="text-[10px] text-muted-foreground/70 mt-1">{timeAgo}</p>
          </div>

          <div className="shrink-0 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
            {isUnread && onMarkRead && (
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6"
                onClick={(e) => {
                  e.stopPropagation();
                  onMarkRead(notification.id);
                }}
                title="标记已读"
              >
                <Check className="h-3 w-3" />
              </Button>
            )}
            {onDismiss && (
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6"
                onClick={(e) => {
                  e.stopPropagation();
                  onDismiss(notification.id);
                }}
                title="忽略"
              >
                <X className="h-3 w-3" />
              </Button>
            )}
          </div>
        </div>

        {isActionable && (
          <div className="mt-2">
            <Button
              size="sm"
              variant="outline"
              className="h-7 text-xs"
              onClick={(e) => {
                e.stopPropagation();
                onAction?.(notification);
              }}
            >
              <CheckCircle className="h-3 w-3 mr-1" />
              处理
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
