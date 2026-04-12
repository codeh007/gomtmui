"use client";

import { useQueryClient } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";
import { useRpcMutation } from "mtmsdk/supabase/use-sb-query/use-rpc-mutation";
import { getRpcQueryKey } from "mtmsdk/supabase/use-sb-query/use-rpc-query";
import { Button } from "mtxuilib/ui/button";
import { DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "mtxuilib/ui/dialog";
import { Input } from "mtxuilib/ui/input";
import { Label } from "mtxuilib/ui/label";
import { useState } from "react";
import { invalidateNotificationQueries } from "./notification-query";
import type { TelegramVerifyCodePayload, UserNotificationRecord } from "./schemas";

interface TelegramVerifyCodeViewProps {
  notification: UserNotificationRecord & { action_payload: TelegramVerifyCodePayload };
  onSuccess: () => void;
  onCancel: () => void;
}

export function TelegramVerifyCodeView({ notification, onSuccess, onCancel }: TelegramVerifyCodeViewProps) {
  const [code, setCode] = useState("");
  const queryClient = useQueryClient();

  const completeActionMutation = useRpcMutation("notification_complete_action");
  const submitCodeMutation = useRpcMutation("telegram_login_submit_code", {
    onSuccess: () => {
      completeActionMutation.mutate(
        { p_id: notification.id },
        {
          onSuccess: () => {
            void queryClient.invalidateQueries({
              queryKey: getRpcQueryKey("cloud_account_get"),
            });
            void queryClient.invalidateQueries({
              queryKey: getRpcQueryKey("cloud_account_list_cursor"),
            });
            invalidateNotificationQueries(queryClient);

            onSuccess();
            setCode("");
          },
        },
      );
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (code.trim()) {
      submitCodeMutation.mutate({
        p_account_id: notification.action_payload.account_id,
        p_code: code.trim(),
      });
    }
  };

  const isPending = submitCodeMutation.isPending || completeActionMutation.isPending;

  return (
    <>
      <DialogHeader>
        <DialogTitle>输入 Telegram 验证码</DialogTitle>
        <DialogDescription>
          {notification.action_payload.code_type === "app" ? (
            <span>
              验证码已发送至您的 <strong>Telegram 客户端</strong> (非手机短信)。
            </span>
          ) : notification.action_payload.code_type === "sms" ? (
            <span>
              验证码已发送至您的 <strong>手机短信</strong>。
            </span>
          ) : (
            <span>验证码已发送，请查收。</span>
          )}
          请在 {notification.action_payload.timeout || 120} 秒内输入。
        </DialogDescription>
      </DialogHeader>

      <form onSubmit={handleSubmit}>
        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="verify-code">验证码</Label>
            <Input
              id="verify-code"
              placeholder="请输入 5 位验证码"
              value={code}
              onChange={(e) => setCode(e.target.value)}
              maxLength={6}
              autoComplete="one-time-code"
              inputMode="numeric"
              pattern="[0-9]*"
              className="text-center text-xl tracking-widest"
              disabled={isPending}
              autoFocus
            />
          </div>

          {submitCodeMutation.error && (
            <p className="text-sm text-destructive">{submitCodeMutation.error?.message || "验证码提交失败，请重试"}</p>
          )}
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={onCancel} disabled={isPending}>
            取消
          </Button>
          <Button type="submit" disabled={isPending || !code.trim()}>
            {isPending && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
            提交验证码
          </Button>
        </DialogFooter>
      </form>
    </>
  );
}
