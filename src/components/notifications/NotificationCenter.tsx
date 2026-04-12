"use client";

import { Bell } from "lucide-react";
import { useRpcQuery } from "mtmsdk/supabase/use-sb-query/use-rpc-query";
import { Badge } from "mtxuilib/ui/badge";
import { Button } from "mtxuilib/ui/button";
import { Dialog, DialogContent } from "mtxuilib/ui/dialog";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "mtxuilib/ui/sheet";
import { useRouter } from "next/navigation";
import { useCallback, useState } from "react";
import { toast } from "sonner";
import { z } from "zod";
import { useJobQueueRetryDlq } from "../job-queue/hooks/useJobQueue";
import { useNotificationSubscription } from "./hooks/use-notification-subscription";
import { NotificationList } from "./NotificationList";
import type { LinkPayload, RetryJobPayload, UserNotificationRecord, ViewTracePayload } from "./schemas";
import { isTelegramTwoFANotification, isTelegramVerifyCodeNotification } from "./schemas";
import { TelegramTwoFAView } from "./TelegramTwoFAView";
import { TelegramVerifyCodeView } from "./TelegramVerifyCodeView";

export function NotificationCenter() {
  const [sheetOpen, setSheetOpen] = useState(false);
  const [actionNotification, setActionNotification] = useState<UserNotificationRecord | null>(null);
  const router = useRouter();

  const retryDlqMutation = useJobQueueRetryDlq();

  useNotificationSubscription();
  const { data: rawUnreadCount } = useRpcQuery("notification_count", {}, { schema: z.number() });
  const unreadCount = rawUnreadCount ?? 0;

  const handleAction = useCallback(
    (notification: UserNotificationRecord) => {
      if (notification.action_type === "system_alert") {
        router.push("/dash/logs?source=system");
        setSheetOpen(false);
        return;
      }

      if (notification.action_type === "retry_job") {
        const payload = notification.action_payload as unknown as RetryJobPayload;
        if (payload?.queue && payload?.job_id) {
          toast.promise(
            retryDlqMutation.mutateAsync({
              queue: payload.queue,
              msgIds: [Number(payload.job_id)],
            }),
            {
              loading: "Retrying job...",
              success: "Job retry submitted",
              error: "Failed to retry job",
            },
          );
        } else {
          toast.error("Invalid retry payload: missing queue or job_id");
        }
        return;
      }

      if (notification.action_type === "view_trace") {
        const payload = notification.action_payload as unknown as ViewTracePayload;
        const traceId = payload?.trace_id;

        if (!traceId) {
          toast.error("Invalid trace payload: missing trace_id");
          return;
        }

        const baseUrl = process.env.NEXT_PUBLIC_LANGFUSE_BASE_URL;
        if (baseUrl) {
          const url = `${baseUrl.replace(/\/$/, "")}/traces/${traceId}`;
          window.open(url, "_blank");
        } else {
          navigator.clipboard.writeText(traceId);
          toast.success(`Trace ID copied: ${traceId}`);
        }
        return;
      }

      if (notification.action_type === "link") {
        const payload = notification.action_payload as unknown as LinkPayload;
        if (payload?.url) {
          if (payload.url.startsWith("http")) {
            window.open(payload.url, "_blank");
          } else {
            router.push(payload.url);
          }
        }
        setSheetOpen(false);
        return;
      }

      setActionNotification(notification);
      setSheetOpen(false);
    },
    [router],
  );

  const closeActionModal = useCallback(() => {
    setActionNotification(null);
  }, []);

  const isVerifyCodeModal = actionNotification ? isTelegramVerifyCodeNotification(actionNotification) : false;
  const isTwoFAModal = actionNotification ? isTelegramTwoFANotification(actionNotification) : false;

  return (
    <>
      <Button variant="ghost" size="icon" className="relative" onClick={() => setSheetOpen(true)} aria-label="通知中心">
        <Bell className="h-5 w-5" />
        {unreadCount > 0 && (
          <Badge
            variant="destructive"
            className="absolute -top-1 -right-1 h-5 min-w-5 px-1 text-[10px] flex items-center justify-center"
          >
            {unreadCount > 99 ? "99+" : unreadCount}
          </Badge>
        )}
      </Button>

      <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
        <SheetContent side="right" className="w-full sm:max-w-md p-0">
          <SheetHeader className="px-4 py-3 border-b">
            <SheetTitle className="flex items-center gap-2">
              <Bell className="h-5 w-5" />
              通知中心
              {unreadCount > 0 && (
                <Badge variant="secondary" className="ml-1">
                  {unreadCount} 未读
                </Badge>
              )}
            </SheetTitle>
          </SheetHeader>
          <div className="h-[calc(100vh-60px)]">
            <NotificationList onAction={handleAction} enabled={sheetOpen} />
          </div>
        </SheetContent>
      </Sheet>

      <Dialog open={!!actionNotification} onOpenChange={(open) => !open && closeActionModal()}>
        <DialogContent className="sm:max-w-md">
          {actionNotification && isVerifyCodeModal && (
            <TelegramVerifyCodeView
              notification={
                actionNotification as UserNotificationRecord & {
                  action_payload: { account_id: string; timeout: number };
                }
              }
              onSuccess={closeActionModal}
              onCancel={closeActionModal}
            />
          )}

          {actionNotification && isTwoFAModal && (
            <TelegramTwoFAView
              notification={actionNotification as UserNotificationRecord & { action_payload: { account_id: string } }}
              onSuccess={closeActionModal}
              onCancel={closeActionModal}
            />
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
