import { useRpcMutation } from "mtmsdk/supabase/use-sb-query/use-rpc-mutation";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import type { CloudAccount } from "@/components/cloud-account/schemas";
import { TelegramAccountView } from "./TelegramAccountView";
import { StepLoading, StepNeed2FA, StepPending, StepWaitCode } from "./TelegramLoginSteps";
import { TelegramLogo } from "./TelegramLogo";
import type { LoginStep } from "./types";

// 验证码重发倒计时秒数 (对标 Telegram 官方 60 秒)
const DEFAULT_RESEND_COOLDOWN = 60;

interface TelegramLoginFormProps {
  account: CloudAccount | undefined;
  currentStep: LoginStep;
  friendlyError: string | null | undefined;
  lastError: string | undefined;
  timeoutSeconds: number | undefined;
  accountId: string;
  invalidateAccount: () => void;
}

export function TelegramLoginForm({
  account,
  currentStep,
  friendlyError: errorMessage,
  lastError,
  timeoutSeconds,
  accountId,
  invalidateAccount,
}: TelegramLoginFormProps) {
  const [code, setCode] = useState("");
  const [password, setPassword] = useState("");
  const [resendCountdown, setResendCountdown] = useState(0);

  const startLogin = useRpcMutation("telegram_login_start", {
    onSuccess: () => {
      invalidateAccount();
      toast.success("Login started. Please check your other Telegram device for code.");
    },
    onError: (err) => {
      toast.error(`Start login failed: ${err.message}`);
    },
  });

  const submitCode = useRpcMutation("telegram_login_submit_code", {
    onSuccess: () => {
      invalidateAccount();
      toast.success("Code submitted. Verifying...");
    },
    onError: (err) => {
      toast.error(`Submit code failed: ${err.message}`);
    },
  });

  const submit2FA = useRpcMutation("telegram_login_submit_two_fa", {
    onSuccess: () => {
      invalidateAccount();
      toast.success("Password submitted. Verifying...");
    },
    onError: (err) => {
      toast.error(`Submit password failed: ${err.message}`);
    },
  });

  const isGlobalSubmitting = startLogin.isPending || submitCode.isPending || submit2FA.isPending;

  useEffect(() => {
    if (currentStep === "wait_code" && resendCountdown === 0) {
      setResendCountdown(timeoutSeconds ?? DEFAULT_RESEND_COOLDOWN);
    }
  }, [currentStep, timeoutSeconds]);

  useEffect(() => {
    if (resendCountdown <= 0) return;
    const timer = setInterval(() => {
      setResendCountdown((prev) => Math.max(0, prev - 1));
    }, 1000);
    return () => clearInterval(timer);
  }, [resendCountdown]);

  const handleResendCode = async () => {
    await startLogin.mutateAsync({ p_account_id: accountId, p_use_sms: false });
    setResendCountdown(DEFAULT_RESEND_COOLDOWN);
    setCode("");
  };

  const handleSubmitCode = async () => {
    if (!code || code.length < 5) return;
    await submitCode.mutateAsync({ p_account_id: accountId, p_code: code });
    setCode("");
  };

  const handleSubmitPassword = async () => {
    if (!password) return;
    await submit2FA.mutateAsync({ p_account_id: accountId, p_password: password });
    setPassword("");
  };

  const renderContent = () => {
    switch (currentStep) {
      case "fetch_info":
      case "success":
        if (!account) return null;
        return <TelegramAccountView account={account} />;

      case "pending":
      case "failed":
        return (
          <StepPending
            phoneNumber={account?.account_name || "Unknown"}
            lastError={lastError}
            errorMessage={errorMessage}
            isSubmitting={isGlobalSubmitting}
            onStartLogin={() => startLogin.mutateAsync({ p_account_id: accountId, p_use_sms: false })}
          />
        );

      case "send_code":
        return <StepLoading title="Sending Code..." description="Requesting code from Telegram servers." />;

      case "wait_code":
        return (
          <StepWaitCode
            phoneNumber={account?.account_name || "Unknown"}
            lastError={lastError}
            errorMessage={errorMessage}
            code={code}
            setCode={setCode}
            resendCountdown={resendCountdown}
            onResendCode={handleResendCode}
            onSubmit={handleSubmitCode}
            isSubmitting={isGlobalSubmitting}
            isStarting={startLogin.isPending}
            codeType={(account?.metadata as Record<string, any>)?.telegram_code_type}
          />
        );

      case "verify_code":
        return <StepLoading title="Verifying Code..." description="Processing your request..." />;

      case "need_2fa":
        return (
          <StepNeed2FA
            password={password}
            setPassword={setPassword}
            onSubmit={handleSubmitPassword}
            isSubmitting={isGlobalSubmitting}
          />
        );

      default:
        return <div>Unknown Step: {currentStep}</div>;
    }
  };

  return (
    <div className="max-w-md mx-auto w-full">
      <div className="bg-white dark:bg-zinc-900 rounded-2xl shadow-xl border border-zinc-200 dark:border-zinc-800 overflow-hidden">
        <div className="p-8">
          <div className="flex justify-center mb-6">
            <TelegramLogo className="w-12 h-12" />
          </div>
          {renderContent()}
        </div>
      </div>
    </div>
  );
}
