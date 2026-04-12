"use client";

import { useQueryClient } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";
import { useRpcMutation } from "mtmsdk/supabase/use-sb-query/use-rpc-mutation";
import { getRpcQueryKey } from "mtmsdk/supabase/use-sb-query/use-rpc-query";
import { Button } from "mtxuilib/ui/button";
import { Textarea } from "mtxuilib/ui/textarea";
import { useState } from "react";
import { toast } from "sonner";
import type { FlowProps } from "./DeviceFlow";

export const PhoneVerificationFlow: React.FC<FlowProps> = ({ platform, onSuccess, onCancel }) => {
  const [phonesInput, setPhonesInput] = useState("");
  const queryClient = useQueryClient();

  const bulkCreateMutation = useRpcMutation("cloud_account_bulk_create", {
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: getRpcQueryKey("cloud_account_list_cursor") });
      void queryClient.invalidateQueries({ queryKey: getRpcQueryKey("cloud_account_get") });
      toast.success("Accounts added successfully");
      setPhonesInput("");
      onSuccess?.();
    },
    onError: (err) => {
      toast.error(`Failed to add accounts: ${err.message}`);
    },
  });

  const handleBulkAdd = async () => {
    const phones = phonesInput
      .split("\n")
      .map((p) => p.trim())
      .filter((p) => p.length > 0);

    if (phones.length === 0) {
      toast.error("Please enter at least one phone number");
      return;
    }

    if (phones.length > 50) {
      toast.error("Maximum 50 phone numbers allowed at once");
      return;
    }

    try {
      await bulkCreateMutation.mutateAsync({
        p_platform_name: platform.name,
        p_account_names: phones,
        p_status: "pending",
      });
    } catch {
      // Error is handled by the hook's onError callback (toast)
    }
  };

  return (
    <div className="flex flex-col gap-4 py-4">
      <div className="space-y-2">
        <Textarea
          placeholder="+1234567890&#10;+9876543210"
          className="min-h-[200px] font-mono"
          value={phonesInput}
          onChange={(e) => setPhonesInput(e.target.value)}
        />
        <p className="text-sm text-muted-foreground">
          Enter phone numbers, one per line. International format supported (e.g. +1234567890).
        </p>
      </div>

      <div className="flex justify-end gap-2">
        {onCancel && (
          <Button variant="outline" onClick={onCancel}>
            Cancel
          </Button>
        )}
        <Button onClick={handleBulkAdd} disabled={bulkCreateMutation.isPending}>
          {bulkCreateMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          Add Accounts
        </Button>
      </div>
    </div>
  );
};
