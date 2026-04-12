"use client";

import { AlertCircle, Loader2, Lock } from "lucide-react";
import { Alert, AlertDescription } from "mtxuilib/ui/alert";
import { Button } from "mtxuilib/ui/button";
import { Input } from "mtxuilib/ui/input";

interface StepProps {
  isSubmitting?: boolean;
}

export function StepLoading({ title, description }: { title: string; description: string }) {
  return (
    <div className="text-center space-y-6 py-8">
      <Loader2 className="w-12 h-12 animate-spin text-[#0088cc] mx-auto" />
      <div className="space-y-2">
        <h3 className="text-lg font-medium">{title}</h3>
        <p className="text-muted-foreground text-sm">{description}</p>
      </div>
    </div>
  );
}

interface StepPendingProps extends StepProps {
  phoneNumber: string;
  lastError?: string | null;
  errorMessage?: string | null;
  onStartLogin: () => void;
}

export function StepPending({ phoneNumber, lastError, errorMessage, isSubmitting, onStartLogin }: StepPendingProps) {
  return (
    <div className="space-y-6">
      <div className="text-center space-y-2">
        <h3 className="text-xl font-semibold">Sign in to Telegram</h3>
        <p className="text-muted-foreground text-sm">Please confirm your phone number.</p>
      </div>

      <div className="space-y-4">
        <div className="space-y-2">
          <p className="text-sm font-medium">Phone Number</p>
          <div className="flex gap-2">
            <div className="w-full h-10 px-3 py-2 rounded-md border border-zinc-200 bg-zinc-100 dark:border-zinc-800 dark:bg-zinc-800 text-sm font-mono flex items-center text-muted-foreground cursor-not-allowed">
              {phoneNumber}
            </div>
          </div>
        </div>

        {lastError && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{errorMessage}</AlertDescription>
          </Alert>
        )}

        <Button
          onClick={onStartLogin}
          className="w-full bg-[#0088cc] hover:bg-[#0077b5]"
          size="lg"
          disabled={isSubmitting}
        >
          {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
          Send Verification Code
        </Button>
      </div>
    </div>
  );
}

interface StepWaitCodeProps extends StepProps {
  phoneNumber: string;
  lastError?: string | null;
  errorMessage?: string | null;
  code: string;
  setCode: (code: string) => void;
  resendCountdown: number;
  onResendCode: () => void;
  onSubmit: () => void;
  isStarting?: boolean;
  codeType?: string;
}

export function StepWaitCode({
  phoneNumber,
  lastError,
  errorMessage,
  code,
  setCode,
  resendCountdown,
  onResendCode,
  onSubmit,
  isSubmitting,
  isStarting,
  codeType,
}: StepWaitCodeProps) {
  return (
    <div className="space-y-6">
      <div className="text-center space-y-2">
        <h3 className="text-xl font-semibold">{phoneNumber}</h3>
        <p className="text-muted-foreground text-sm">
          {codeType === "app" ? (
            <span>
              We've sent the code to the <b>Telegram app</b> on your other device.
            </span>
          ) : codeType === "sms" ? (
            <span>
              We've sent the code to your <b>phone via SMS</b>.
            </span>
          ) : (
            <span>
              We've sent the code to the <b>Telegram</b> app on your other device.
            </span>
          )}
        </p>
      </div>

      {lastError && (
        <Alert
          variant={lastError.includes("Code sent via") ? "default" : "destructive"}
          className={
            lastError.includes("Code sent via")
              ? "border-blue-200 bg-blue-50 text-blue-800 dark:border-blue-800 dark:bg-blue-950 dark:text-blue-200"
              : ""
          }
        >
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{errorMessage}</AlertDescription>
        </Alert>
      )}

      <div className="space-y-4 pt-4">
        <div className="flex justify-center">
          <Input
            type="text"
            placeholder="Code"
            maxLength={6}
            value={code}
            onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
            className="text-center text-2xl tracking-[0.5em] h-14 w-48 font-mono"
            autoFocus
            onKeyDown={(e) => e.key === "Enter" && onSubmit()}
          />
        </div>

        <Button
          onClick={onSubmit}
          className="w-full bg-[#0088cc] hover:bg-[#0077b5]"
          size="lg"
          disabled={isSubmitting || code.length < 5}
        >
          {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
          Next
        </Button>

        <div className="text-center text-sm">
          {resendCountdown > 0 ? (
            <span className="text-muted-foreground">
              Resend code in <span className="font-medium">{resendCountdown}s</span>
            </span>
          ) : (
            <button
              type="button"
              onClick={onResendCode}
              disabled={isStarting}
              className="text-[#0088cc] hover:underline disabled:opacity-50 disabled:no-underline"
            >
              {isStarting ? "Sending..." : "Didn't receive the code? Resend"}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

interface StepNeed2FAProps extends StepProps {
  password: string;
  setPassword: (password: string) => void;
  onSubmit: () => void;
}

export function StepNeed2FA({ password, setPassword, onSubmit, isSubmitting }: StepNeed2FAProps) {
  return (
    <div className="space-y-6">
      <div className="text-center space-y-2">
        <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center mx-auto text-[#0088cc] mb-4">
          <Lock className="w-6 h-6" />
        </div>
        <h3 className="text-xl font-semibold">Enter Password</h3>
        <p className="text-muted-foreground text-sm">Your account is protected with Two-Step Verification.</p>
      </div>

      <div className="space-y-4">
        <Input
          type="password"
          placeholder="Password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="h-12"
          autoFocus
          onKeyDown={(e) => e.key === "Enter" && onSubmit()}
        />

        <Button
          onClick={onSubmit}
          className="w-full bg-[#0088cc] hover:bg-[#0077b5]"
          size="lg"
          disabled={isSubmitting || !password}
        >
          {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
          Next
        </Button>
      </div>
    </div>
  );
}
