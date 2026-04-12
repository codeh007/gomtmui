"use client";

import { useQueryClient } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";
import { useRpcMutation } from "mtmsdk/supabase/use-sb-query/use-rpc-mutation";
import { getRpcQueryKey } from "mtmsdk/supabase/use-sb-query/use-rpc-query";
import { randomUUID } from "mtxuilib/lib/utils";
import { Alert, AlertDescription, AlertTitle } from "mtxuilib/ui/alert";
import { Button } from "mtxuilib/ui/button";
import { useSearchParams } from "next/navigation";
import React, { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { normalizeError } from "@/lib/error-utils";
import type { FlowProps } from "./DeviceFlow";
import { generateCodeChallenge, generateRandomString } from "./pkce-utils";

const PKCE_STORAGE_KEY = "mtm_oauth_auth_code_pkce";

export const OAuth2AuthCodeFlow: React.FC<FlowProps> = ({ platform, accountId, onSuccess }) => {
  const searchParams = useSearchParams();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const queryClient = useQueryClient();
  const processedRef = useRef(false);

  const upsert = useRpcMutation("cloud_account_upsert", {
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: getRpcQueryKey("cloud_account_list_cursor") });
      void queryClient.invalidateQueries({ queryKey: getRpcQueryKey("cloud_account_get") });
    },
  });

  const handleCallback = useCallback(
    async (code: string, state: string) => {
      if (processedRef.current) return;
      processedRef.current = true;

      setIsLoading(true);
      setError(null);
      try {
        const stored = sessionStorage.getItem(PKCE_STORAGE_KEY);
        if (!stored) throw new Error("No PKCE data found in session storage. Please try connecting again.");

        const { verifier, state: storedState, platform: storedPlatform } = JSON.parse(stored);

        if (state !== storedState) throw new Error("Security state mismatch. Please try again.");
        if (storedPlatform !== platform.name) {
          // This might happen if the user switched platforms in the UI while the redirect was in progress
          throw new Error(`Platform mismatch: expected ${storedPlatform}, but currently adding ${platform.name}`);
        }

        // We use the current window location as redirect URI (without query params)
        const redirectUri = window.location.origin + window.location.pathname;

        console.log(`[OAuth2AuthCodeFlow] Exchanging code for ${platform.name}`);

        // Call gomtmui's inline mtgate API route to exchange the authorization code.
        const response = await fetch("/api/cf/cloud-account/oauth/exchange", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            platformName: platform.name,
            code,
            codeVerifier: verifier,
            redirectUri,
          }),
        });

        const tokenData = (await response.json()) as {
          access_token: string;
          refresh_token?: string;
          expires_in?: number;
          refresh_token_expires_in?: number;
          email?: string;
          user?: { email?: string };
          error?: string;
          message?: string;
        };
        if (!response.ok) {
          throw new Error(tokenData.error || tokenData.message || "Failed to exchange authorization code");
        }

        const accountEmail = tokenData.email || tokenData.user?.email || "";
        const accountName = accountEmail || `${platform.displayName} Account`;

        await upsert.mutateAsync({
          p_id: accountId ?? randomUUID(),
          p_platform_name: platform.name,
          p_account_name: accountName,
          p_account_email: accountEmail,
          p_access_token: tokenData.access_token,
          p_refresh_token: tokenData.refresh_token,
          p_token_expires_at: tokenData.expires_in
            ? new Date(Date.now() + tokenData.expires_in * 1000).toISOString()
            : undefined,
          p_refresh_token_expires_at: tokenData.refresh_token_expires_in
            ? new Date(Date.now() + tokenData.refresh_token_expires_in * 1000).toISOString()
            : undefined,
          p_status: "active",
        });

        sessionStorage.removeItem(PKCE_STORAGE_KEY);

        const url = new URL(window.location.href);
        url.searchParams.delete("code");
        url.searchParams.delete("state");
        window.history.replaceState({}, "", url.toString());

        toast.success(`Successfully connected ${platform.displayName}`);
        onSuccess?.();
      } catch (err: unknown) {
        // We don't reset processedRef.current here because the code is likely consumed/invalid
        const appError = normalizeError(err, "An unexpected error occurred during authentication");
        console.error("[OAuth2AuthCodeFlow] exchange failed:", appError.originalError);
        setError(appError.message);
      } finally {
        setIsLoading(false);
      }
    },
    [platform, upsert, onSuccess, accountId],
  );

  useEffect(() => {
    // Check if we are returning from a redirect
    const code = searchParams?.get("code");
    const state = searchParams?.get("state");

    if (code && state) {
      handleCallback(code, state);
    }
  }, [handleCallback, searchParams]);

  const handleConnect = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const verifier = generateRandomString(64);
      const challenge = await generateCodeChallenge(verifier);
      const state = generateRandomString(16);

      // Save PKCE data to session storage
      sessionStorage.setItem(
        PKCE_STORAGE_KEY,
        JSON.stringify({
          verifier,
          state,
          platform: platform.name,
        }),
      );

      const oauth = platform.oauth;
      if (!oauth || !oauth.authUrl) {
        throw new Error(`Platform ${platform.displayName} is not correctly configured for OAuth`);
      }

      const redirectUri = window.location.origin + window.location.pathname;

      const authUrl = new URL(oauth.authUrl);
      authUrl.searchParams.set("client_id", oauth.clientId);
      authUrl.searchParams.set("redirect_uri", redirectUri);
      authUrl.searchParams.set("response_type", "code");
      authUrl.searchParams.set("state", state);
      authUrl.searchParams.set("code_challenge", challenge);
      authUrl.searchParams.set("code_challenge_method", "S256");

      if (oauth.scope && oauth.scope.length > 0) {
        authUrl.searchParams.set("scope", oauth.scope.join(" "));
      }

      // Redirect to the platform's authorization page
      window.location.href = authUrl.toString();
    } catch (err: unknown) {
      const appError = normalizeError(err, "Failed to initialize authentication flow");
      setError(appError.message);
      setIsLoading(false);
    }
  };

  return (
    <div className="flex flex-col items-center justify-center p-6 space-y-4 min-h-[200px]">
      {error && (
        <Alert variant="destructive" className="mb-4">
          <AlertTitle>Authentication Error</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {isLoading ? (
        <div className="flex flex-col items-center space-y-4">
          <Loader2 className="h-10 w-10 animate-spin text-primary" />
          <p className="text-sm font-medium text-muted-foreground">
            {searchParams?.has("code") ? "Exchanging security codes..." : "Preparing connection..."}
          </p>
        </div>
      ) : (
        <>
          <div className="text-center space-y-2">
            <h3 className="text-lg font-semibold">Connect {platform.displayName}</h3>
            <p className="text-sm text-muted-foreground max-w-sm">
              You will be redirected to {platform.displayName} to authorize access to your account.
            </p>
          </div>
          <Button onClick={handleConnect} className="w-full max-w-xs h-11" size="lg">
            Connect Securely
          </Button>
          <p className="text-xs text-muted-foreground">Uses PKCE for enhanced security.</p>
        </>
      )}
    </div>
  );
};
