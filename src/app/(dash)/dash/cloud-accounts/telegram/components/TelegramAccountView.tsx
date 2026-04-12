"use client";

import { useQueryClient } from "@tanstack/react-query";
import { Loader2, Lock, LogOut, RefreshCw, Send, ShieldCheck } from "lucide-react";
import { useRpcMutation } from "mtmsdk/supabase/use-sb-query/use-rpc-mutation";
import { getRpcQueryKey } from "mtmsdk/supabase/use-sb-query/use-rpc-query";
import { Button } from "mtxuilib/ui/button";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import type { CloudAccountRecord, TelegramCredentials } from "@/components/cloud-account/schemas";

interface TelegramAccountViewProps {
  account: CloudAccountRecord;
}

export function TelegramAccountView({ account }: TelegramAccountViewProps) {
  const telegramUser = account?.metadata?.telegram_user;
  const queryClient = useQueryClient();
  const router = useRouter();
  const deleteMutation = useRpcMutation("cloud_account_delete", {
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: getRpcQueryKey("cloud_account_list_cursor") });
      void queryClient.invalidateQueries({ queryKey: getRpcQueryKey("cloud_account_get") });
      toast.success("Logged out successfully");
      router.push("/dash/cloud-accounts/telegram");
    },
    onError: (err) => {
      toast.error(`Failed to logout: ${err.message}`);
    },
  });

  const handleLogout = async () => {
    if (confirm("Are you sure you want to log out? This will remove the session from the server.")) {
      try {
        await deleteMutation.mutateAsync({ p_id: account.id });
      } catch (_e) {
        // Error handled in onError
      }
    }
  };

  if (!telegramUser) {
    return (
      <div className="text-center space-y-6 py-8">
        <div className="relative w-16 h-16 mx-auto">
          <div className="absolute inset-0 border-4 border-zinc-100 dark:border-zinc-800 rounded-full"></div>
          <div className="absolute inset-0 border-4 border-[#0088cc] border-t-transparent rounded-full animate-spin"></div>
        </div>
        <div className="space-y-2">
          <h3 className="text-lg font-medium">Synchronizing Account...</h3>
          <p className="text-muted-foreground text-sm">Fetching user profile and verification status.</p>
        </div>
      </div>
    );
  }

  const { first_name, last_name, username, phone, id } = telegramUser;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const fullName = [first_name, last_name].filter(Boolean).join(" ");
  const initials = (fullName || "TG")
    .split(" ")
    .map((n: string) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);

  return (
    <div className="space-y-6">
      <div className="text-center space-y-4 py-4">
        <div className="w-20 h-20 bg-blue-100 dark:bg-blue-900/30 rounded-full flex items-center justify-center mx-auto text-blue-600 dark:text-blue-400 text-2xl font-bold border-4 border-white dark:border-zinc-800 shadow-sm relative">
          {initials}
          <div className="absolute bottom-0 right-0 w-6 h-6 bg-green-500 border-4 border-white dark:border-zinc-800 rounded-full" />
        </div>

        <div className="space-y-1">
          <h3 className="text-2xl font-bold text-gray-900 dark:text-gray-100">{fullName}</h3>
          {username && <p className="text-blue-500 font-medium text-sm">@{username}</p>}
        </div>

        <div className="bg-zinc-50 dark:bg-zinc-800/50 rounded-lg p-4 space-y-2 text-sm text-left border border-zinc-100 dark:border-zinc-800">
          <div className="flex justify-between py-1 border-b border-zinc-100 dark:border-zinc-700/50 last:border-0 items-center">
            <span className="text-muted-foreground">User ID</span>
            <span className="font-mono text-xs">{id}</span>
          </div>
          <div className="flex justify-between py-1 border-b border-zinc-100 dark:border-zinc-700/50 last:border-0 items-center">
            <span className="text-muted-foreground">Phone</span>
            <span className="font-mono text-xs">{phone}</span>
          </div>
          {(account?.credentials as TelegramCredentials | undefined)?.has_2fa && (
            <div className="flex justify-between py-1 border-b border-zinc-100 dark:border-zinc-700/50 last:border-0 items-center">
              <span className="text-muted-foreground">2FA</span>
              <span className="text-green-600 dark:text-green-400 font-medium flex items-center text-xs">
                <Lock className="w-3 h-3 mr-1" />
                Enabled
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Business Operations Section */}
      <div className="space-y-3 pt-2">
        <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Available Operations</h4>
        <div className="grid grid-cols-2 gap-3">
          <Button variant="outline" className="h-auto py-3 flex flex-col gap-2 items-center justify-center" disabled>
            <RefreshCw className="w-5 h-5 mb-1" />
            <span className="text-xs">Check Session</span>
          </Button>
          <Button variant="outline" className="h-auto py-3 flex flex-col gap-2 items-center justify-center" disabled>
            <Send className="w-5 h-5 mb-1" />
            <span className="text-xs">Test Message</span>
          </Button>
          <Button variant="outline" className="h-auto py-3 flex flex-col gap-2 items-center justify-center" disabled>
            <ShieldCheck className="w-5 h-5 mb-1" />
            <span className="text-xs">Security Check</span>
          </Button>
          <Button
            variant="outline"
            className="h-auto py-3 flex flex-col gap-2 items-center justify-center text-red-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/20"
            onClick={handleLogout}
            disabled={deleteMutation.isPending}
          >
            {deleteMutation.isPending ? (
              <Loader2 className="w-5 h-5 mb-1 animate-spin" />
            ) : (
              <LogOut className="w-5 h-5 mb-1" />
            )}
            <span className="text-xs">Log Out</span>
          </Button>
        </div>
        <p className="text-center text-xs text-muted-foreground pt-2">
          Session active. Automation tasks can now use this account.
        </p>
      </div>
    </div>
  );
}
