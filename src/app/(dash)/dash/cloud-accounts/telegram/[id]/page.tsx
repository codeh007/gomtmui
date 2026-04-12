"use client";

import { type Query, useQueryClient } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";
import { getRpcQueryKey, useRpcQuery } from "mtmsdk/supabase/use-sb-query/use-rpc-query";
import { useParams } from "next/navigation";
import { z } from "zod";
import { type CloudAccountRecord, CloudAccountRecordSchema } from "@/components/cloud-account/schemas";
import { getSingleRouteParam } from "@/lib/route-params";
import { AutomationPanel } from "../components/AutomationPanel";
import { TelegramLoginForm } from "../components/TelegramLoginForm";
import type { LoginStep } from "../components/types";

type TelegramLoginMetadata = {
  telegram_login_error?: string;
  telegram_login_step?: LoginStep;
  telegram_login_timeout?: number;
};

function deriveLoginStep(account: CloudAccountRecord | undefined): LoginStep {
  if (!account) return "pending";

  const metadata = (account.metadata || {}) as TelegramLoginMetadata;
  const metaStep = metadata.telegram_login_step;

  if (metaStep) {
    return metaStep;
  }

  switch (account.status) {
    case "pending":
      return "pending";
    case "active":
      return "success";
    case "token_expired":
    case "needs_reauth":
      return "failed";
    default:
      return "pending";
  }
}

function getFriendlyErrorMessage(msg: string | null | undefined): string | null {
  if (!msg) return null;
  if (msg.includes("FLOOD_WAIT")) {
    const seconds = msg.match(/FLOOD_WAIT_(\d+)/)?.[1];
    return seconds
      ? `Too many attempts. Please wait ${seconds} seconds before trying again.`
      : "Too many attempts. Please wait a while.";
  }
  if (msg.includes("PHONE_NUMBER_INVALID")) return "The phone number you entered is invalid.";
  if (msg.includes("PHONE_CODE_INVALID")) return "The verification code is invalid.";
  if (msg.includes("PHONE_CODE_EXPIRED")) return "The verification code has expired.";
  if (msg.includes("PASSWORD_HASH_INVALID")) return "The password you entered is incorrect.";
  if (msg.includes("SESSION_PASSWORD_NEEDED")) return "Two-Step Verification is enabled.";
  return msg;
}

function getRefetchInterval(query: Query): number | false {
  const data = query.state.data as CloudAccountRecord[] | undefined;
  const account = data?.[0];
  const metadata = account?.metadata as TelegramLoginMetadata | undefined;
  const loginStep = metadata?.telegram_login_step;

  if (account?.status === "active" && (!loginStep || loginStep === "success")) {
    return 5000;
  }

  return 1000;
}

export default function TelegramAccountPage() {
  const params = useParams<{ id?: string | string[] }>();
  const accountId = getSingleRouteParam(params?.id) ?? "";
  const queryClient = useQueryClient();

  const { data: accountData, isLoading: isAccountLoading } = useRpcQuery(
    "cloud_account_get",
    { p_id: accountId },
    {
      schema: z.array(CloudAccountRecordSchema),
      refetchInterval: getRefetchInterval,
    },
  );
  const account = accountData?.[0];
  const metadata = (account?.metadata || {}) as TelegramLoginMetadata;

  const step = deriveLoginStep(account);

  const lastError = metadata.telegram_login_error;
  const timeoutSeconds = metadata.telegram_login_timeout;

  const friendlyError = getFriendlyErrorMessage(lastError);

  const invalidateAccount = () => {
    void queryClient.invalidateQueries({
      queryKey: getRpcQueryKey("cloud_account_get"),
    });
  };

  if (isAccountLoading && !account) {
    return (
      <div className="flex justify-center items-center h-[calc(100vh-200px)]">
        <Loader2 className="animate-spin h-8 w-8 text-muted-foreground" />
      </div>
    );
  }

  if (!account) return null;

  return (
    <div className="container max-w-3xl mx-auto py-8 space-y-8">
      <div className="flex justify-center">
        <TelegramLoginForm
          account={account}
          currentStep={step}
          friendlyError={friendlyError}
          lastError={lastError}
          timeoutSeconds={timeoutSeconds}
          accountId={accountId}
          invalidateAccount={invalidateAccount}
        />
      </div>

      <div className="max-w-md mx-auto w-full">
        <AutomationPanel account={account} />
      </div>
    </div>
  );
}
