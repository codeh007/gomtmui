import { useSupabaseAuth } from "mtmsdk/supabase/auth-provider";
import { useSupabaseBrowser } from "mtmsdk/supabase/context";
import { useRpcMutation } from "mtmsdk/supabase/use-sb-query/use-rpc-mutation";
import { useCallback, useEffect, useRef } from "react";
import type { CloudAccountRecord } from "../schemas";

const CHECK_INTERVAL = 5 * 60 * 1000; // 5 minutes

export function useTokenAutoRefresh() {
  const { session } = useSupabaseAuth();
  const sb = useSupabaseBrowser();

  const upsertMutation = useRpcMutation("cloud_account_upsert");

  const isRefreshing = useRef(false);
  const lastRunTime = useRef(0);

  const refreshAction = useCallback(async () => {
    if (!session || isRefreshing.current) return;
    const now = Date.now();
    if (now - lastRunTime.current < 30 * 1000) {
      return;
    }

    isRefreshing.current = true;
    lastRunTime.current = now;
    try {
      const { data: expiredAccounts, error: fetchErr } = await sb.rpc("cloud_account_list_cursor", {
        p_status: "token_expired",
        p_limit: 50,
      });

      if (fetchErr) {
        console.error("[useTokenAutoRefresh] Failed to fetch expired accounts:", fetchErr);
        return;
      }

      if (!session) return;

      const accounts = expiredAccounts as unknown as CloudAccountRecord[];
      if (!accounts || accounts.length === 0) {
        return;
      }

      // 2. Refresh each account
      for (const account of accounts) {
        if (!session) break;

        try {
          const resp = await fetch("/api/cf/cloud-account/token/refresh", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({ accountId: account.id }),
          });

          if (!session) break;

          const result = (await resp.json()) as {
            access_token: string;
            refresh_token?: string;
            expires_in?: number;
            refresh_expires_in?: number;
            error?: string;
          };

          if (!resp.ok) {
            console.error(`[useTokenAutoRefresh] Refresh API failed for ${account.id}:`, result);
            await upsertMutation.mutateAsync({
              p_id: account.id,
              p_platform_name: account.platform_name,
              p_status: "token_expired",
              p_status_reason: result.error || "Platform refresh failed",
            });
            continue;
          }

          // 3. Update DB with new tokens
          if (!session) break;

          let tokenExpiresAt: string | undefined;
          if (result.expires_in) {
            tokenExpiresAt = new Date(Date.now() + result.expires_in * 1000).toISOString();
          }
          let refreshTokenExpiresAt: string | undefined;
          if (result.refresh_expires_in) {
            refreshTokenExpiresAt = new Date(Date.now() + result.refresh_expires_in * 1000).toISOString();
          }

          await upsertMutation.mutateAsync({
            p_id: account.id,
            p_platform_name: account.platform_name,
            p_access_token: result.access_token,
            p_refresh_token: result.refresh_token,
            p_token_expires_at: tokenExpiresAt,
            p_refresh_token_expires_at: refreshTokenExpiresAt,
            p_status: "active",
            p_status_reason: "", // Clear error
          });
        } catch (err) {
          if (err instanceof Error && err.name === "AbortError") {
            break;
          }
          const errorMessage = err instanceof Error ? err.message : "Internal error";
          console.error(`[useTokenAutoRefresh] Unexpected error refreshing ${account.id}:`, err);
          await upsertMutation.mutateAsync({
            p_id: account.id,
            p_platform_name: account.platform_name,
            p_status: "token_expired",
            p_status_reason: errorMessage,
          });
        }
      }
    } catch (err) {
      if (err instanceof Error && err.name === "AbortError") {
        // Ignore AbortError
      } else {
        console.error("[useTokenAutoRefresh] Error in refresh cycle:", err);
      }
    } finally {
      isRefreshing.current = false;
    }
  }, [session, upsertMutation, sb]);

  useEffect(() => {
    if (!session) return;

    // Run initial check after a short delay to let things settle
    const initialTimer = setTimeout(() => {
      refreshAction();
    }, 1000);

    // Set up interval
    const timer = setInterval(refreshAction, CHECK_INTERVAL);
    return () => {
      clearTimeout(initialTimer);
      clearInterval(timer);
    };
  }, [session, refreshAction]);
}
