"use client";

import { useQueryClient } from "@tanstack/react-query";
import { useRpcMutation } from "mtmsdk/supabase/use-sb-query/use-rpc-mutation";
import { getRpcQueryKey } from "mtmsdk/supabase/use-sb-query/use-rpc-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "mtxuilib/ui/card";
import { Label } from "mtxuilib/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "mtxuilib/ui/select";
import { Switch } from "mtxuilib/ui/switch";
import { toast } from "sonner";
import type { CloudAccountRecord } from "@/components/cloud-account/schemas";

interface AutomationPanelProps {
  account: CloudAccountRecord;
}

export function AutomationPanel({ account }: AutomationPanelProps) {
  const queryClient = useQueryClient();
  const updateMutation = useRpcMutation("cloud_account_update_automation_config", {
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: getRpcQueryKey("cloud_account_get") });
      toast.success("Configuration updated");
    },
    onError: (err) => {
      toast.error(`Failed to update configuration: ${err.message}`);
    },
  });

  const config = (account.automation_config || {}) as Record<string, any>;

  const handleUpdate = (key: string, value: any) => {
    const newConfig = { ...config, [key]: value };
    updateMutation.mutate({
      p_account_id: account.id,
      p_config: newConfig,
    });
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Automation Settings</CardTitle>
        <CardDescription>Configure automated behaviors for this Telegram account.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <SwitchItem
          label="Auto Login"
          description="Automatically re-login when the session expires."
          checked={!!config.auto_login}
          onCheckedChange={(checked) => handleUpdate("auto_login", checked)}
          disabled={updateMutation.isPending}
        />

        <div className="flex flex-col space-y-2">
          <Label>SMS Provider</Label>
          <Select
            value={config.sms_provider || "manual"}
            onValueChange={(value) => handleUpdate("sms_provider", value)}
            disabled={updateMutation.isPending}
          >
            <SelectTrigger>
              <SelectValue placeholder="Select SMS Provider" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="manual">Manual Input</SelectItem>
              <SelectItem value="auto">Auto (Best Match)</SelectItem>
              <SelectItem value="5sim">5sim.net</SelectItem>
              <SelectItem value="smspva">smspva.com</SelectItem>
            </SelectContent>
          </Select>
          <p className="text-sm text-muted-foreground">Choose how to receive verification codes.</p>
        </div>

        <SwitchItem
          label="Auto Sync Contacts"
          description="Periodically sync contacts to the database."
          checked={!!config.auto_contact_sync}
          onCheckedChange={(checked) => handleUpdate("auto_contact_sync", checked)}
          disabled={updateMutation.isPending}
        />
      </CardContent>
    </Card>
  );
}

function SwitchItem({
  label,
  description,
  checked,
  onCheckedChange,
  disabled,
}: {
  label: string;
  description?: string;
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <div className="flex items-center justify-between space-x-2">
      <div className="flex flex-col space-y-1">
        <Label className="text-base">{label}</Label>
        {description && <span className="text-sm text-muted-foreground">{description}</span>}
      </div>
      <Switch checked={checked} onCheckedChange={onCheckedChange} disabled={disabled} />
    </div>
  );
}
