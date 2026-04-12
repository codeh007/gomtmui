"use client";

import { AlertCircle, ArrowLeft } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "mtxuilib/ui/alert";
import { Button } from "mtxuilib/ui/button";
import React from "react";
import { AuthFlowRouter } from "@/components/cloud-account/AuthFlowRouter";
import type { CloudAccount } from "@/components/cloud-account/schemas";
import { PLATFORM_CONFIGS, type PlatformName } from "@/lib/cloud-account/platform-configs";

interface ReauthFlowProps {
  account: CloudAccount;
  onSuccess?: () => void;
  onCancel?: () => void;
}

export const ReauthFlow: React.FC<ReauthFlowProps> = ({ account, onSuccess, onCancel }) => {
  const platform = PLATFORM_CONFIGS[account.platform_name as PlatformName];

  if (!platform) {
    return (
      <div className="p-6">
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Configuration Error</AlertTitle>
          <AlertDescription>Platform configuration not found for "{account.platform_name}".</AlertDescription>
        </Alert>
        <Button variant="ghost" onClick={onCancel} className="mt-4 gap-2">
          <ArrowLeft className="h-4 w-4" /> Back to Accounts
        </Button>
      </div>
    );
  }

  return (
    <div className="flex flex-col space-y-4">
      {/* Header is handled by parent Dialog */}

      {onCancel && (
        <div className="px-6 pb-4">
          <Button variant="ghost" size="sm" onClick={onCancel} className="gap-2">
            <ArrowLeft className="h-4 w-4" />
            Back to Accounts
          </Button>
        </div>
      )}

      <div className="w-full flex flex-col gap-4 flex-1">
        <AuthFlowRouter platform={platform} accountId={account.id} onSuccess={onSuccess} onCancel={undefined} />
      </div>
    </div>
  );
};
