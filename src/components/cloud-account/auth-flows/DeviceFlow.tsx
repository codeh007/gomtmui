"use client";

import { useQueryClient } from "@tanstack/react-query";
import { Check, Copy, ExternalLink, Loader2 } from "lucide-react";
import { useRpcMutation } from "mtmsdk/supabase/use-sb-query/use-rpc-mutation";
import { getRpcQueryKey } from "mtmsdk/supabase/use-sb-query/use-rpc-query";
import type { Json } from "mtmsdk/types/database.types";
import { useToast } from "mtxuilib/hooks/useToast";
import { randomUUID } from "mtxuilib/lib/utils";
import { Button } from "mtxuilib/ui/button";
import React, { useEffect, useRef, useState } from "react";
import type { PlatformConfig } from "@/lib/cloud-account/platform-configs";
import { tunnelFetch } from "@/lib/tunnel-fetch";

export interface FlowProps {
  platform: PlatformConfig;
  accountId?: string;
  onSuccess?: () => void;
  onCancel?: () => void;
}

export const DeviceFlow: React.FC<FlowProps> = ({ platform, accountId, onSuccess }) => {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [deviceAuthData, setDeviceAuthData] = useState<{
    user_code: string;
    verification_uri: string;
    verification_uri_complete?: string;
    device_code: string;
    interval?: number;
    code_verifier?: string;
  } | null>(null);
  const [isConnecting, setIsConnecting] = useState(false);
  const [isCopied, setIsCopied] = useState(false);
  const authWindowRef = useRef<Window | null>(null);
  const isMountedRef = useRef(true);

  const upsertMutation = useRpcMutation("cloud_account_upsert", {
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: getRpcQueryKey("cloud_account_list_cursor") });
      void queryClient.invalidateQueries({ queryKey: getRpcQueryKey("cloud_account_get") });
    },
    onError: (err) => {
      toast({
        title: "Save Failed",
        description: err.message,
        variant: "destructive",
      });
    },
  });

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
      if (authWindowRef.current && !authWindowRef.current.closed) {
        authWindowRef.current.close();
      }
    };
  }, []);

  // PKCE Helpers
  const base64UrlEncode = (bytes: Uint8Array): string => {
    const binString = Array.from(bytes, (byte) => String.fromCharCode(byte)).join("");
    return btoa(binString).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
  };

  const generateCodeVerifier = () => {
    const array = new Uint8Array(64);
    window.crypto.getRandomValues(array);
    return base64UrlEncode(array);
  };

  const generateCodeChallenge = async (verifier: string) => {
    const encoder = new TextEncoder();
    const data = encoder.encode(verifier);
    const hash = await window.crypto.subtle.digest("SHA-256", data);
    return base64UrlEncode(new Uint8Array(hash));
  };

  const openPopup = (url: string) => {
    const width = 600;
    const height = 700;
    const left = window.screen.width / 2 - width / 2;
    const top = window.screen.height / 2 - height / 2;

    const win = window.open(
      url,
      "OAuthAuthorization",
      `toolbar=no, location=no, directories=no, status=no, menubar=no, scrollbars=yes, resizable=yes, copyhistory=no, width=${width}, height=${height}, top=${top}, left=${left}`,
    );
    if (win) {
      authWindowRef.current = win;
    }
    return win;
  };

  const startDeviceAuth = async () => {
    setIsConnecting(true);
    try {
      const config = platform.oauth;
      if (!config || !config.tokenUrl || !config.deviceAuthorizationUrl) {
        throw new Error("Invalid platform config for device flow");
      }

      const verifier = generateCodeVerifier();
      const challenge = await generateCodeChallenge(verifier);

      const bodyParams = [
        `client_id=${encodeURIComponent(config.clientId)}`,
        `scope=${encodeURIComponent(config.scope?.join(" ") || "default")}`,
        `code_challenge=${encodeURIComponent(challenge)}`,
        "code_challenge_method=S256",
      ];

      const res = await tunnelFetch(config.deviceAuthorizationUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
          Accept: "application/json",
        },
        body: bodyParams.join("&"),
      });

      if (!res.ok) {
        const text = await res.text();
        throw new Error(`Device auth start failed: ${text}`);
      }

      const data = (await res.json()) as {
        verification_uri_complete?: string;
        verification_uri: string;
        user_code: string;
        device_code: string;
        interval?: number;
      };

      if (data.verification_uri_complete) {
        openPopup(data.verification_uri_complete);
      }

      setDeviceAuthData({
        ...data,
        code_verifier: verifier,
      });

      pollDeviceAuth(data.device_code, data.interval ?? 5, verifier);
    } catch (error: unknown) {
      toast({
        title: "Auth Failed",
        description: error instanceof Error ? error.message : String(error),
        variant: "destructive",
      });
      setIsConnecting(false);
    }
  };

  const pollDeviceAuth = async (deviceCode: string, intervalSeconds: number, codeVerifier?: string) => {
    const intervalMs = (intervalSeconds || 5) * 1000;

    const poll = async () => {
      if (!isMountedRef.current) return;

      try {
        const config = platform.oauth;
        if (!config) throw new Error("Missing oauth config");

        const params = [
          "grant_type=urn:ietf:params:oauth:grant-type:device_code",
          `client_id=${encodeURIComponent(config.clientId)}`,
          `device_code=${encodeURIComponent(deviceCode)}`,
        ];
        if (codeVerifier) {
          params.push(`code_verifier=${encodeURIComponent(codeVerifier)}`);
        }

        const res = await tunnelFetch(config.tokenUrl, {
          method: "POST",
          headers: {
            "Content-Type": "application/x-www-form-urlencoded",
            Accept: "application/json",
          },
          body: params.join("&"),
        });

        if (res.ok) {
          const sessionData = (await res.json()) as {
            access_token: string;
            refresh_token?: string;
            token_type?: string;
            expires_in?: number;
            [key: string]: unknown;
          };
          let tokenExpiresAt: string | undefined;
          if (sessionData.expires_in) {
            tokenExpiresAt = new Date(Date.now() + sessionData.expires_in * 1000).toISOString();
          }

          await upsertMutation.mutateAsync({
            p_id: accountId ?? randomUUID(),
            p_platform_name: platform.name,
            p_account_name: `${platform.displayName} (Auto)`,
            p_access_token: sessionData.access_token,
            p_refresh_token: sessionData.refresh_token,
            p_token_type: sessionData.token_type || "Bearer",
            p_token_expires_at: tokenExpiresAt,
            p_session_data: sessionData as unknown as Json,
            p_status: "active",
          });

          toast({
            title: "Success",
            description: "Account connected successfully.",
          });

          if (authWindowRef.current && !authWindowRef.current.closed) {
            authWindowRef.current.close();
          }

          setDeviceAuthData(null);
          setIsConnecting(false);
          if (onSuccess) onSuccess();
          return;
        }

        const data = (await res.json()) as { error?: string; error_description?: string };
        if (data.error === "authorization_pending") {
          setTimeout(poll, intervalMs);
          return;
        }
        if (data.error === "slow_down") {
          setTimeout(poll, intervalMs + 2000);
          return;
        }

        throw new Error(data.error_description || data.error || "Polling failed");
      } catch (error: unknown) {
        if (!isMountedRef.current) return;
        toast({
          title: "Connection Failed",
          description: error instanceof Error ? error.message : String(error),
          variant: "destructive",
        });
        setIsConnecting(false);
        setDeviceAuthData(null);
      }
    };

    setTimeout(poll, intervalMs);
  };

  const copyCode = () => {
    if (deviceAuthData?.user_code) {
      navigator.clipboard.writeText(deviceAuthData.user_code);
      setIsCopied(true);
      setTimeout(() => setIsCopied(false), 2000);
      toast({ title: "Copied to clipboard" });
    }
  };

  if (!deviceAuthData) {
    return (
      <div className="flex flex-col items-center justify-center p-6 space-y-4">
        <p className="text-sm text-center text-muted-foreground">
          You will need to authorize this application on your {platform.displayName} account.
        </p>
        <Button onClick={startDeviceAuth} disabled={isConnecting} className="w-full max-w-xs">
          {isConnecting ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Starting...
            </>
          ) : (
            "Start Device Authorization"
          )}
        </Button>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center space-y-6 p-6">
      <div className="text-center space-y-2">
        <p className="text-sm font-medium">Step 1: Copy this code</p>
        <div className="flex items-center gap-2 justify-center">
          <code className="text-3xl font-mono font-bold bg-muted px-6 py-3 rounded-lg tracking-widest border shadow-sm">
            {deviceAuthData.user_code}
          </code>
          <Button variant="outline" size="icon" onClick={copyCode} className="h-12 w-12">
            {isCopied ? <Check className="h-5 w-5 text-green-500" /> : <Copy className="h-5 w-5" />}
          </Button>
        </div>
      </div>

      <div className="text-center space-y-2">
        <p className="text-sm font-medium">Step 2: Enter code at</p>
        <Button
          variant="secondary"
          className="w-full max-w-xs gap-2"
          onClick={() => {
            const url = deviceAuthData.verification_uri_complete || deviceAuthData.verification_uri;
            openPopup(url);
          }}
        >
          {platform.displayName} Auth Page
          <ExternalLink className="h-4 w-4" />
        </Button>
      </div>

      <div className="flex flex-col items-center gap-2 pt-4">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <p className="text-sm text-muted-foreground animate-pulse">Waiting for you to complete authorization...</p>
      </div>
    </div>
  );
};
