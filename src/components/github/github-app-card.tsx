"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Github } from "lucide-react";
import {
  v1GetAuthServiceConfigOptions,
  v1UpdateAuthServiceConfigMutation,
} from "mtmsdk/sbmng/@tanstack/react-query.gen";
import { useRpcMutation } from "mtmsdk/supabase/use-sb-query/use-rpc-mutation";
import { getRpcQueryKey, useRpcQuery } from "mtmsdk/supabase/use-sb-query/use-rpc-query";

import { Badge } from "mtxuilib/ui/badge";
import { Card, CardContent, CardDescription, CardHeader } from "mtxuilib/ui/card";
import { Skeleton } from "mtxuilib/ui/skeleton";
import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { z } from "zod";
import { GithubAppForm } from "./github-app-form";
import type { GithubConfig } from "./types";

const INSTALL_EVENT_KEY = "github_installation_event";
const INSTALL_EVENT_TTL_MS = 30_000;

// Zod Schema for GitHub App Config (Nullable for RPC return)
const githubConfigSchema = z
  .object({
    app_id: z.string().optional(),
    slug: z.string().optional(),
    client_id: z.string().optional(),
    client_secret: z.string().optional(),
    private_key: z.string().optional(),
    html_url: z.string().optional(),
    installation_id: z.coerce.string().optional(),
    repo_full_name: z.string().optional(),
  })
  .nullable();

export function GithubAppCard() {
  const queryClient = useQueryClient();
  const [manifestLoading, setManifestLoading] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);
  const handledInstallationIdRef = useRef<string>("");

  // 使用新的 useRpcQuery Hook with Schema
  const ghConfigQuery = useRpcQuery("sys_config_get", { p_key: "github_app" }, { schema: githubConfigSchema });

  const isConfigured = useMemo(() => {
    const config = ghConfigQuery.data;
    return !!config?.app_id;
  }, [ghConfigQuery.data]);

  const projectUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
  const projectRef = useMemo(() => {
    const url = new URL(projectUrl);
    if (url.hostname.includes(".supabase.co")) {
      return url.hostname.split(".")[0];
    }
    return url.hostname;
  }, [projectUrl]);

  const ghManifest = useMemo(() => {
    const origin = typeof window !== "undefined" ? window.location.origin : "";
    return {
      name: `Gomtm GitHub ${Math.random().toString(36).substring(7)}`,
      url: origin,
      hook_attributes: undefined,
      redirect_url: origin ? `${origin}/dash/github/callback` : "",
      setup_url: origin ? `${origin}/dash/github/callback` : "",
      callback_urls: projectRef
        ? [origin ? `${origin}/auth/callback` : "", `https://${projectRef}.supabase.co/auth/v1/callback`]
        : [],
      public: true,
      default_permissions: {
        contents: "write",
        metadata: "read",
        pull_requests: "read",
        emails: "read",
        administration: "read",
        actions: "write",
        workflows: "write",
      },
      default_events: ["pull_request", "push"],
    };
  }, [projectRef]);

  const authConfigQuery = useQuery({
    ...v1GetAuthServiceConfigOptions({
      path: { ref: projectRef },
    }),
    enabled: !!projectRef && isConfigured,
  });

  const isSynced = useMemo(() => {
    if (!authConfigQuery.data || !ghConfigQuery.data) return false;
    const authData = authConfigQuery.data as Record<string, unknown>;
    const ghData = ghConfigQuery.data as GithubConfig | null | undefined;
    return (
      authData.external_github_enabled === true &&
      authData.external_github_client_id === ghData?.client_id &&
      authData.external_github_secret === ghData?.client_secret
    );
  }, [authConfigQuery.data, ghConfigQuery.data]);

  const syncMutation = useMutation({
    ...v1UpdateAuthServiceConfigMutation(),
    onSuccess: () => {
      authConfigQuery.refetch();
    },
  });

  const deleteConfigMutation = useRpcMutation("sys_config_set", {
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: getRpcQueryKey("sys_config_get") });
      ghConfigQuery.refetch();
    },
  });

  const saveConfigMutation = useRpcMutation("sys_config_set", {
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: getRpcQueryKey("sys_config_get") });
      ghConfigQuery.refetch();
    },
  });
  const saveGithubConfig = saveConfigMutation.mutateAsync;

  useEffect(() => {
    async function handleInstallSuccess(id: string) {
      if (!ghConfigQuery.data || ghConfigQuery.data.installation_id === id || handledInstallationIdRef.current === id) {
        return;
      }

      handledInstallationIdRef.current = id;
      try {
        const newConfig = { ...ghConfigQuery.data, installation_id: id };
        await saveGithubConfig({
          p_key: "github_app",
          p_value: newConfig,
          p_description: "GitHub Application Configuration for System (with installation_id)",
        });
        toast.success("GitHub App connected to repository successfully!");
      } catch {
        handledInstallationIdRef.current = "";
        toast.error("Failed to save GitHub installation id");
      }
    }

    const readStorageEvent = (rawValue: string | null) => {
      if (!rawValue) return;

      try {
        const data = JSON.parse(rawValue) as {
          type?: string;
          installationId?: string;
          timestamp?: number;
        };
        if (data.type !== "github-installation-success" || !data.installationId) return;
        if (typeof data.timestamp !== "number") return;
        if (Date.now() - data.timestamp > INSTALL_EVENT_TTL_MS) return;
        void handleInstallSuccess(data.installationId);
      } finally {
        window.localStorage.removeItem(INSTALL_EVENT_KEY);
      }
    };

    const handleMessage = (event: MessageEvent) => {
      if (event.origin !== window.location.origin || event.data?.type !== "github-installation-success") return;
      const id = event.data.installationId;
      if (id) {
        void handleInstallSuccess(id);
      }
    };

    const handleStorage = (event: StorageEvent) => {
      if (event.key !== INSTALL_EVENT_KEY) return;
      readStorageEvent(event.newValue);
    };

    window.addEventListener("message", handleMessage);
    window.addEventListener("storage", handleStorage);
    readStorageEvent(window.localStorage.getItem(INSTALL_EVENT_KEY));

    return () => {
      window.removeEventListener("message", handleMessage);
      window.removeEventListener("storage", handleStorage);
    };
  }, [ghConfigQuery.data, saveGithubConfig]);

  async function handleSyncAuth(config: GithubConfig) {
    if (!projectRef) {
      toast.error("Supabase Project Ref not found.");
      return;
    }
    if (!config.client_id || !config.client_secret) {
      toast.error("Missing Client ID or Secret in configuration.");
      return;
    }

    const tId = toast.loading("Syncing GitHub credentials to Supabase Auth...");

    try {
      const origin = typeof window !== "undefined" ? window.location.origin : "";
      console.log("Syncing to Supabase with config:", {
        client_id: config.client_id,
        // Don't log full secret
        client_secret_prefix: config.client_secret?.substring(0, 4),
        site_url: origin,
      });

      const payload = {
        external_github_enabled: true,
        external_github_client_id: config.client_id,
        external_github_secret: config.client_secret,
        site_url: origin,
        uri_allow_list: origin ? `${origin}/auth/callback` : "",
      };

      console.log("Sync Payload:", {
        ...payload,
        external_github_secret: `${payload.external_github_secret?.substring(0, 4)}***`,
      });

      const result = (await syncMutation.mutateAsync({
        path: { ref: projectRef },
        body: payload,
      })) as Record<string, unknown>;

      console.log("Sync Result from Supabase:", result);

      const isEnabled = result?.external_github_enabled === true;
      const returnedClientId = result?.external_github_client_id;

      if (!isEnabled) {
        toast.warning("Sync finished, but GitHub provider is disabled in Supabase.");
      } else if (returnedClientId !== config.client_id) {
        console.error("Client ID Mismatch!", { sent: config.client_id, returned: returnedClientId });
        toast.error("Sync partial failure: Client ID was not updated. Please check logs.");
      } else {
        toast.success("GitHub Auth Sync Successful");
      }
    } catch (error) {
      console.error("Sync Exception:", error);
      toast.error(error instanceof Error ? error.message : "Sync failed", { id: tId });
    }
  }

  async function handleDeleteConfig() {
    const emptyConfig = {
      app_id: "",
      slug: "",
      client_id: "",
      client_secret: "",
      private_key: "",
      html_url: "",
    };

    try {
      await deleteConfigMutation.mutateAsync({
        p_key: "github_app",
        p_value: emptyConfig,
        p_description: "Cleared by administrator",
      });
      toast.success("Configuration deleted");
    } catch (err) {
      toast.error(`Failed to delete configuration: ${err instanceof Error ? err.message : "Unknown error"}`);
    }
  }

  function startManifestFlow() {
    if (!formRef.current) return;
    setManifestLoading(true);
    if (typeof window !== "undefined") {
      window.localStorage.setItem("gh_app_setup_active", "true");
    }
    formRef.current.submit();
  }

  function handleInstallToRepo() {
    const htmlUrl = ghConfigQuery.data?.html_url;
    if (!htmlUrl) {
      toast.error("App HTML URL is not available. Please save the configuration first.");
      return;
    }

    const width = 800;
    const height = 700;
    const left = window.screen.width / 2 - width / 2;
    const top = window.screen.height / 2 - height / 2;

    window.open(
      `${htmlUrl}/installations/new`,
      "github-install",
      `width=${width},height=${height},left=${left},top=${top},resizable=yes,scrollbars=yes,status=yes`,
    );
  }

  if (ghConfigQuery.isLoading) {
    return (
      <Card className="border-slate-200 dark:border-slate-800 shadow-lg overflow-hidden">
        <CardHeader className="relative bg-slate-50/50 dark:bg-slate-900/30 border-b border-slate-100 dark:border-slate-800 p-8">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
            <div className="space-y-1 w-full">
              <div className="flex items-center gap-3">
                <Skeleton className="h-10 w-10 rounded-lg" />
                <Skeleton className="h-8 w-48" />
                <Skeleton className="h-6 w-24 rounded-full" />
              </div>
              <Skeleton className="h-4 w-full max-w-xl mt-2" />
            </div>
          </div>
        </CardHeader>

        <CardContent className="p-0">
          <div className="p-8 space-y-10">
            {/* One-Click Setup Skeleton */}
            <div className="p-6 rounded-2xl border border-slate-100 dark:border-slate-800 flex flex-col md:flex-row items-center gap-6">
              <Skeleton className="h-16 w-16 rounded-xl" />
              <div className="flex-1 space-y-2 w-full">
                <Skeleton className="h-6 w-32" />
                <Skeleton className="h-4 w-full max-w-md" />
              </div>
              <Skeleton className="h-12 w-40 rounded-md" />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-12 gap-10">
              {/* Basic Info Skeleton */}
              <div className="md:col-span-5 space-y-6">
                <div className="space-y-2">
                  <Skeleton className="h-4 w-32" />
                  <Skeleton className="h-3 w-48" />
                </div>
                <div className="space-y-6">
                  {[1, 2, 3].map((i) => (
                    <div key={i} className="space-y-2">
                      <Skeleton className="h-4 w-20" />
                      <Skeleton className="h-10 w-full" />
                    </div>
                  ))}
                </div>
              </div>

              {/* Separator */}
              <div className="hidden md:flex md:col-span-1 justify-center py-4">
                <Skeleton className="h-full w-px" />
              </div>

              {/* Auth Info Skeleton */}
              <div className="md:col-span-6 space-y-6">
                <div className="space-y-2">
                  <Skeleton className="h-4 w-40" />
                  <Skeleton className="h-3 w-56" />
                </div>
                <div className="space-y-6">
                  {[1, 2, 3].map((i) => (
                    <div key={i} className="space-y-2">
                      <Skeleton className="h-4 w-24" />
                      <Skeleton className="h-10 w-full" />
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="w-full h-px bg-slate-100 dark:bg-slate-800" />

            {/* Private Key Skeleton */}
            <div className="space-y-4">
              <div className="space-y-2">
                <Skeleton className="h-6 w-40" />
                <Skeleton className="h-4 w-96" />
              </div>
              <Skeleton className="h-48 w-full rounded-md" />
            </div>
          </div>

          {/* Footer Skeleton */}
          <div className="px-8 py-6 bg-slate-50/50 dark:bg-slate-900/50 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between">
            <div className="flex gap-2">
              <Skeleton className="h-9 w-24" />
              <Skeleton className="h-9 w-40" />
            </div>
            <Skeleton className="h-10 w-40" />
          </div>
        </CardContent>
      </Card>
    );
  }

  const defaultValues: GithubConfig = ((ghConfigQuery.data as GithubConfig) || {}) as GithubConfig;

  return (
    <div className="max-w-4xl mx-auto space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <Card className="border-slate-200 dark:border-slate-800 shadow-lg overflow-hidden">
        <CardHeader className="relative bg-slate-50/50 dark:bg-slate-900/30 border-b border-slate-100 dark:border-slate-800 p-8">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
            <div className="space-y-1">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-slate-900 dark:bg-slate-100 rounded-lg text-white dark:text-slate-900">
                  <Github className="h-6 w-6" />
                </div>
                <h2 className="text-2xl font-extrabold tracking-tight">GitHub Application</h2>
                {isConfigured && (
                  <Badge className="bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20 hover:bg-emerald-500/20">
                    <span className="relative flex h-2 w-2 mr-1.5">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                      <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
                    </span>
                    Configured
                  </Badge>
                )}
              </div>
              <CardDescription className="text-base text-slate-500 dark:text-slate-400 max-w-xl">
                Configure your global GitHub App integration. This allows the system to access repositories, dispatch
                workflows, and handle OAuth flow.
              </CardDescription>
            </div>
          </div>
        </CardHeader>

        <CardContent className="p-0">
          <GithubAppForm
            defaultValues={defaultValues}
            isSynced={isSynced}
            isSyncing={syncMutation.isPending}
            onSync={handleSyncAuth}
            onRunSetup={startManifestFlow}
            isSetupLoading={manifestLoading}
            onDelete={handleDeleteConfig}
            onInstallToRepo={handleInstallToRepo}
          />
          <form ref={formRef} action="https://github.com/settings/apps/new" method="post" className="hidden">
            <input type="hidden" name="manifest" value={JSON.stringify(ghManifest)} />
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
