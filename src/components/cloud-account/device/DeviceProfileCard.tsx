"use client";

import { useQueryClient } from "@tanstack/react-query";
import { Check, Copy, Fingerprint, History, Loader2, RefreshCw } from "lucide-react";
import { useRpcMutation } from "mtmsdk/supabase/use-sb-query/use-rpc-mutation";
import { getRpcQueryKey } from "mtmsdk/supabase/use-sb-query/use-rpc-query";
import type { Json } from "mtmsdk/types/database.types";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "mtxuilib/ui/alert-dialog";
import { Button } from "mtxuilib/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "mtxuilib/ui/card";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "mtxuilib/ui/collapsible";
import { useState } from "react";
import { toast } from "sonner";
import type { CloudAccountRecord } from "../schemas";
import { DeviceHistoryList } from "./DeviceHistoryList";
import { generateNewFingerprint } from "./utils";

interface DeviceProfileCardProps {
  account: CloudAccountRecord;
}

export function DeviceProfileCard({ account }: DeviceProfileCardProps) {
  const queryClient = useQueryClient();
  const bindMutation = useRpcMutation("cloud_account_upsert", {
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: getRpcQueryKey("cloud_account_list_cursor") });
      void queryClient.invalidateQueries({
        queryKey: getRpcQueryKey("cloud_account_get"),
      });
      toast.success("设备指纹已绑定");
    },
    onError: (err) => {
      console.error(err);
      toast.error(`绑定失败: ${err.message}`);
    },
  });
  const [isOpenHistory, setIsOpenHistory] = useState(false);
  const [copied, setCopied] = useState(false);

  const handleGenerateNew = () => {
    const newFingerprint = generateNewFingerprint();
    bindMutation.mutate({
      p_id: account.id,
      p_device_fingerprint: newFingerprint as unknown as Json,
      p_platform_name: account.platform_name,
    });
  };

  const handleCopy = () => {
    if (account.device_fingerprint) {
      navigator.clipboard.writeText(JSON.stringify(account.device_fingerprint, null, 2));
      setCopied(true);
      toast.success("Copied to clipboard");
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <Card className="w-full">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Fingerprint className="h-5 w-5 text-primary" />
            <CardTitle>Device Fingerprint</CardTitle>
          </div>
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="outline" size="sm" disabled={bindMutation.isPending}>
                {bindMutation.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                ) : (
                  <RefreshCw className="h-4 w-4 mr-2" />
                )}
                Generate New
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Generate New Device Fingerprint?</AlertDialogTitle>
                <AlertDialogDescription>
                  This will generate a new random device profile for this account. The current profile will be saved to
                  history.
                  <br />
                  <br />
                  <strong>Warning:</strong> Changing device fingerprint might trigger security checks on the target
                  platform (e.g., Google, Telegram).
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction onClick={handleGenerateNew}>Generate</AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
        <CardDescription>Manage the simulated device identity used for this cloud account.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Current Fingerprint Display */}
        <div className="relative rounded-md bg-muted p-4 font-mono text-xs">
          <div className="absolute top-2 right-2">
            <Button variant="ghost" size="icon" className="h-6 w-6" onClick={handleCopy}>
              {copied ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
            </Button>
          </div>
          {account.device_fingerprint ? (
            <pre className="overflow-auto max-h-[200px]">{JSON.stringify(account.device_fingerprint, null, 2)}</pre>
          ) : (
            <span className="text-muted-foreground italic">No device fingerprint bound.</span>
          )}
        </div>

        {/* History Section */}
        <Collapsible open={isOpenHistory} onOpenChange={setIsOpenHistory} className="border rounded-md p-2">
          <div className="flex items-center justify-between px-2">
            <div className="flex items-center gap-2 font-medium text-sm">
              <History className="h-4 w-4" />
              Device History
              <span className="text-muted-foreground text-xs ml-1">({account.device_history?.length || 0})</span>
            </div>
            <CollapsibleTrigger asChild>
              <Button variant="ghost" size="sm">
                {isOpenHistory ? "Hide" : "Show"}
              </Button>
            </CollapsibleTrigger>
          </div>
          <CollapsibleContent className="pt-2">
            <DeviceHistoryList accountId={account.id} history={account.device_history || []} />
          </CollapsibleContent>
        </Collapsible>
      </CardContent>
    </Card>
  );
}
