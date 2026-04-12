"use client";

import { useQueryClient } from "@tanstack/react-query";

import { Eye, EyeOff, Loader2 } from "lucide-react";
import { useRpcMutation } from "mtmsdk/supabase/use-sb-query/use-rpc-mutation";
import { getRpcQueryKey } from "mtmsdk/supabase/use-sb-query/use-rpc-query";
import { Button } from "mtxuilib/ui/button";
import { DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "mtxuilib/ui/dialog";
import { Input } from "mtxuilib/ui/input";
import { Label } from "mtxuilib/ui/label";
import { useState } from "react";
import { invalidateNotificationQueries } from "./notification-query";
import type { TelegramTwoFAPayload, UserNotificationRecord } from "./schemas";

interface TelegramTwoFAViewProps {
  notification: UserNotificationRecord & { action_payload: TelegramTwoFAPayload };
  onSuccess: () => void;
  onCancel: () => void;
}

export function TelegramTwoFAView({ notification, onSuccess, onCancel }: TelegramTwoFAViewProps) {
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const queryClient = useQueryClient();

  const completeActionMutation = useRpcMutation("notification_complete_action");
  const submitPasswordMutation = useRpcMutation("telegram_login_submit_two_fa", {
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
            setPassword("");
          },
        },
      );
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (password.trim()) {
      submitPasswordMutation.mutate({
        p_account_id: notification.action_payload.account_id,
        p_password: password,
      });
    }
  };

  const isPending = submitPasswordMutation.isPending || completeActionMutation.isPending;

  return (
    <>
      <DialogHeader>
        <DialogTitle>输入两步验证密码</DialogTitle>
        <DialogDescription>您的 Telegram 账号已启用两步验证，请输入您设置的密码</DialogDescription>
      </DialogHeader>

      <form onSubmit={handleSubmit}>
        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="2fa-password">两步验证密码</Label>
            <div className="relative">
              <Input
                id="2fa-password"
                type={showPassword ? "text" : "password"}
                placeholder="请输入两步验证密码"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                disabled={isPending}
                autoFocus
                className="pr-10"
              />
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="absolute right-0 top-0 h-full px-3 hover:bg-transparent"
                onClick={() => setShowPassword(!showPassword)}
              >
                {showPassword ? (
                  <EyeOff className="h-4 w-4 text-muted-foreground" />
                ) : (
                  <Eye className="h-4 w-4 text-muted-foreground" />
                )}
              </Button>
            </div>
          </div>

          {submitPasswordMutation.error && (
            <p className="text-sm text-destructive">
              {submitPasswordMutation.error?.message || "密码验证失败，请重试"}
            </p>
          )}
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={onCancel} disabled={isPending}>
            取消
          </Button>
          <Button type="submit" disabled={isPending || !password.trim()}>
            {isPending && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
            验证
          </Button>
        </DialogFooter>
      </form>
    </>
  );
}
