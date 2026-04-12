"use client";

import { useQueryClient } from "@tanstack/react-query";
import { Loader2, RefreshCw } from "lucide-react";
import { useRpcMutation } from "mtmsdk/supabase/use-sb-query/use-rpc-mutation";
import { getRpcQueryKey } from "mtmsdk/supabase/use-sb-query/use-rpc-query";
import type { Json } from "mtmsdk/types/database.types";
import { useToast } from "mtxuilib/hooks/useToast";
import { randomUUID } from "mtxuilib/lib/utils";
import { Button } from "mtxuilib/ui/button";
import React, { useEffect, useRef, useState } from "react";
import QRCode from "react-qr-code";
import type { FlowProps } from "./DeviceFlow";

interface QRData {
  qr_data: string;
  token?: string;
  session_id: string;
  expires_at?: string;
  poll_interval?: number;
}

export const QRCodeFlow: React.FC<FlowProps> = ({ platform, accountId, onSuccess }) => {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [qrData, setQrData] = useState<QRData | null>(null);
  const [isConnecting, setIsConnecting] = useState(false);
  const [status, setStatus] = useState<"idle" | "loading" | "polling" | "expired" | "error">("idle");
  const [error, setError] = useState<string | null>(null);
  const isMountedRef = useRef(true);
  const pollTimerRef = useRef<NodeJS.Timeout | null>(null);

  const upsertMutation = useRpcMutation("cloud_account_upsert", {
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: getRpcQueryKey("cloud_account_list_cursor") });
      void queryClient.invalidateQueries({ queryKey: getRpcQueryKey("cloud_account_get") });
    },
  });

  useEffect(() => {
    isMountedRef.current = true;
    startAuth();
    return () => {
      isMountedRef.current = false;
      if (pollTimerRef.current) clearTimeout(pollTimerRef.current);
    };
  }, []);

  const startAuth = async () => {
    if (!platform.qrcode?.generateUrl) {
      setError("QR code generation not configured for this platform.");
      setStatus("error");
      return;
    }

    setIsConnecting(true);
    setStatus("loading");
    setError(null);

    try {
      const res = await fetch(platform.qrcode.generateUrl);
      if (!res.ok) {
        throw new Error(`Failed to generate QR code: ${await res.text()}`);
      }

      const data = (await res.json()) as QRData;
      if (!isMountedRef.current) return;

      setQrData(data);
      setStatus("polling");
      pollStatus(data.session_id, data.poll_interval || 2000);
    } catch (err) {
      if (!isMountedRef.current) return;
      const errorMessage = err instanceof Error ? err.message : "Unknown error";
      setError(errorMessage);
      setStatus("error");
      toast({
        title: "Auth Failed",
        description: errorMessage,
        variant: "destructive",
      });
    } finally {
      if (isMountedRef.current) setIsConnecting(false);
    }
  };

  const pollStatus = async (sessionId: string, interval: number) => {
    if (!isMountedRef.current || !platform.qrcode?.pollUrl) return;

    try {
      const url = new URL(platform.qrcode.pollUrl);
      url.searchParams.set("session_id", sessionId);

      const res = await fetch(url.toString());
      if (!isMountedRef.current) return;

      if (res.status === 401) {
        // Pending
        pollTimerRef.current = setTimeout(() => pollStatus(sessionId, interval), interval);
        return;
      }

      const data = (await res.json()) as {
        status: string;
        message?: string;
        account_name?: string;
        account_email?: string;
        access_token?: string;
        refresh_token?: string;
        token_type?: string;
        expires_in?: number;
        session_data?: unknown;
      };
      if (res.ok && data.status === "success") {
        // Successful authorization
        await handleSuccess(data);
      } else if (data.status === "expired") {
        setStatus("expired");
      } else if (data.status === "error") {
        throw new Error(data.message || "Authentication failed");
      } else {
        // Continue polling for other intermediate statuses
        pollTimerRef.current = setTimeout(() => pollStatus(sessionId, interval), interval);
      }
    } catch (err) {
      if (!isMountedRef.current) return;
      console.error("Polling error:", err);
      // We don't necessarily want to stop polling on a temporary network error
      pollTimerRef.current = setTimeout(() => pollStatus(sessionId, interval), interval);
    }
  };

  const handleSuccess = async (data: {
    account_name?: string;
    account_email?: string;
    access_token?: string;
    refresh_token?: string;
    token_type?: string;
    expires_in?: number;
    session_data?: unknown;
  }) => {
    try {
      let tokenExpiresAt: string | undefined;
      if (data.expires_in) {
        tokenExpiresAt = new Date(Date.now() + data.expires_in * 1000).toISOString();
      }

      await upsertMutation.mutateAsync({
        p_id: accountId ?? randomUUID(),
        p_platform_name: platform.name,
        p_account_name: data.account_name || `${platform.displayName} Account`,
        p_account_email: data.account_email || "",
        p_access_token: data.access_token || "",
        p_refresh_token: data.refresh_token || "",
        p_token_type: data.token_type || "Bearer",
        p_token_expires_at: tokenExpiresAt ?? undefined,
        p_refresh_token_expires_at: undefined,
        p_session_data: (data.session_data || data) as unknown as Json,
        p_status: "active",
        p_status_reason: undefined,
        p_credentials: {},
        p_metadata: {},
        p_quota_data: {},
        p_device_fingerprint: {},
      });

      toast({
        title: "Success",
        description: "Account connected successfully via QR code.",
      });

      if (onSuccess) onSuccess();
    } catch (err) {
      console.error("Success handler error:", err);
      setError("Failed to save account details.");
      setStatus("error");
    }
  };

  return (
    <div className="flex flex-col items-center justify-center p-6 space-y-6 min-h-[300px]">
      <div className="text-center space-y-2">
        <h3 className="text-lg font-semibold">Scan QR Code</h3>
        <p className="text-sm text-muted-foreground">Use the {platform.displayName} mobile app to scan this code.</p>
      </div>

      <div className="relative group">
        <div className="bg-white p-4 rounded-xl shadow-md border group-hover:shadow-lg transition-shadow duration-300">
          {status === "loading" && (
            <div className="w-[200px] h-[200px] flex items-center justify-center">
              <Loader2 className="w-10 h-10 animate-spin text-primary" />
            </div>
          )}

          {status === "error" && (
            <div className="w-[200px] h-[200px] flex flex-col items-center justify-center text-center space-y-2">
              <p className="text-sm text-destructive">{error}</p>
              <Button size="sm" variant="outline" onClick={startAuth} className="gap-2">
                <RefreshCw className="w-4 h-4" /> Try Again
              </Button>
            </div>
          )}

          {(status === "polling" || status === "idle") && qrData && (
            <div className="p-2 bg-white">
              <QRCode value={qrData.qr_data} size={200} style={{ height: "auto", maxWidth: "100%", width: "100%" }} />
            </div>
          )}

          {status === "expired" && (
            <div className="w-[200px] h-[200px] flex flex-col items-center justify-center bg-muted/80 backdrop-blur-[2px] rounded-lg absolute inset-0 text-center space-y-2">
              <p className="text-sm font-medium">Code Expired</p>
              <Button size="sm" onClick={startAuth} className="gap-2">
                <RefreshCw className="w-4 h-4" /> Refresh Code
              </Button>
            </div>
          )}
        </div>

        {status === "polling" && (
          <div className="flex items-center justify-center gap-2 mt-4 text-xs text-muted-foreground animate-pulse">
            <Loader2 className="w-3 h-3 animate-spin" />
            Waiting for confirmation...
          </div>
        )}
      </div>

      <div className="w-full max-w-xs space-y-2">
        <Button
          variant="ghost"
          size="sm"
          className="w-full text-xs text-muted-foreground"
          onClick={startAuth}
          disabled={isConnecting}
        >
          Can't scan? Generate a new code
        </Button>
      </div>
    </div>
  );
};
