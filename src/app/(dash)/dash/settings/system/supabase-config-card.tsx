"use client";

import { useForm } from "@tanstack/react-form";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Database } from "lucide-react";
import { v1ExchangeOauthTokenMutation } from "mtmsdk/sbmng/@tanstack/react-query.gen";
import { client } from "mtmsdk/sbmng/client.gen";
import { useRpcMutation } from "mtmsdk/supabase/use-sb-query/use-rpc-mutation";
import { getRpcQueryKey, useRpcQuery } from "mtmsdk/supabase/use-sb-query/use-rpc-query";
import { PasswordInput } from "mtxuilib/mt/inputs/password-input";
import { Button } from "mtxuilib/ui/button";
import { Card, CardContent, CardDescription, CardHeader } from "mtxuilib/ui/card";
import { Field, FieldError, FieldLabel } from "mtxuilib/ui/field";
import { Input } from "mtxuilib/ui/input";
import { Skeleton } from "mtxuilib/ui/skeleton";
import Link from "next/link";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import z from "zod";
import { tunnelFetch } from "@/lib/tunnel-fetch";

// Schema for RPC Return
const sbAppSchema = z
  .object({
    client_id: z.string().nullable().optional(),
    client_secret: z.string().nullable().optional(),
  })
  .nullable()
  .optional();

export const supabaseConfigSchema = z.object({
  pat: z.string(),
  clientId: z.string(),
  clientSecret: z.string(),
});

export type SupabaseConfigData = z.infer<typeof supabaseConfigSchema>;

export function SupabaseConfigCard() {
  const queryClient = useQueryClient();
  const [isConnecting, setIsConnecting] = useState(false);
  const [pat, setPat] = useState("");

  const patQuery = useRpcQuery("sys_config_get", { p_key: "supabase_pat" }, { schema: z.string().nullable() });
  const appQuery = useRpcQuery("sys_config_get", { p_key: "supabase_app" }, { schema: sbAppSchema });

  useEffect(() => {
    if (!patQuery.isLoading) {
      setPat(patQuery.data ?? "");
    }
  }, [patQuery.data, patQuery.isLoading]);

  useEffect(() => {
    client.setConfig({
      baseUrl: "https://api.supabase.com",
      headers: pat ? { Authorization: `Bearer ${pat}` } : {},
      fetch: tunnelFetch,
    });
  }, [pat]);

  const patMutation = useRpcMutation("sys_config_set", {
    onSuccess: (result) => {
      if (result.error) {
        throw result.error;
      }
    },
  });

  const appMutation = useRpcMutation("sys_config_set", {
    onSuccess: (result) => {
      if (result.error) {
        throw result.error;
      }
    },
  });

  const form = useForm({
    defaultValues: {
      pat: "",
      clientId: "",
      clientSecret: "",
    },
    onSubmit: async ({ value }) => {
      try {
        const promises: ReturnType<typeof patMutation.mutateAsync>[] = [];
        if (value.pat !== undefined) {
          promises.push(
            patMutation.mutateAsync({
              p_key: "supabase_pat",
              p_value: value.pat as string,
              p_description: "Supabase Personal Access Token",
            }),
          );
        }

        if (value.clientId !== undefined || value.clientSecret !== undefined) {
          promises.push(
            appMutation.mutateAsync({
              p_key: "supabase_app",
              p_value: {
                client_id: value.clientId ?? null,
                client_secret: value.clientSecret ?? null,
              },
              p_description: "Supabase OAuth App 配置",
            }),
          );
        }

        await Promise.all(promises);

        if (value.pat) {
          setPat(value.pat);
        }

        toast.success("配置已保存");
        queryClient.invalidateQueries({ queryKey: getRpcQueryKey("sys_config_get") });
      } catch (e: unknown) {
        const errorMessage = e instanceof Error ? e.message : "未知错误";
        toast.error("保存配置失败", { description: errorMessage });
      }
    },
  });

  useEffect(() => {
    if (!appQuery.isLoading) {
      const newValues: SupabaseConfigData = {
        pat: pat || "",
        clientId: "",
        clientSecret: "",
      };

      if (appQuery.data) {
        const appData = appQuery.data;
        newValues.clientId = appData?.client_id || "";
        newValues.clientSecret = appData?.client_secret || "";
      }

      form.reset(newValues);
    }
  }, [pat, appQuery.data, appQuery.isLoading, form]);

  const exchangeMutation = useMutation({
    ...v1ExchangeOauthTokenMutation(),
    onSuccess: async (data) => {
      if (!data?.access_token) {
        toast.error("未从 Supabase 获取到 access token");
        return;
      }

      form.setFieldValue("pat", data.access_token);
      setPat(data.access_token);

      // Persist to database immediately upon successful exchange
      try {
        await patMutation.mutateAsync({
          p_key: "supabase_pat",
          p_value: data.access_token,
          p_description: "Supabase Personal Access Token (通过 OAuth 获取)",
        });
        toast.success("已成功连接到 Supabase！");
        queryClient.invalidateQueries({ queryKey: getRpcQueryKey("sys_config_get") });
      } catch (e: unknown) {
        const errorMessage = e instanceof Error ? e.message : "未知错误";
        toast.error("保存 Token 失败", { description: errorMessage });
      }
    },
    onError: (error: Error) => {
      toast.error(`OAuth 错误: ${error.message}`);
    },
  });

  async function doExchangeToken(code: string) {
    const clientId = form.getFieldValue("clientId");
    const clientSecret = form.getFieldValue("clientSecret");

    if (!clientId || !clientSecret) {
      toast.error("需要 Supabase Client ID 和 Secret 才能交换 Token");
      return;
    }

    const redirectUri = `${window.location.origin}/dash/settings/system/supabase-callback`;

    exchangeMutation.mutate({
      body: {
        grant_type: "authorization_code",
        code: code,
        client_id: clientId,
        client_secret: clientSecret,
        redirect_uri: redirectUri,
      },
    });
  }

  // Handle OAuth Authorization Window
  function handleAuthorize() {
    const clientId = form.getFieldValue("clientId");
    if (!clientId) {
      toast.error("请先填写 Supabase Client ID");
      return;
    }
    const redirectUri = `${window.location.origin}/dash/settings/system/supabase-callback`;
    const url = `https://api.supabase.com/v1/oauth/authorize?client_id=${clientId}&redirect_uri=${encodeURIComponent(
      redirectUri,
    )}&response_type=code&scope=all`;

    window.open(url, "SupabaseAuth", "width=600,height=800");
    setIsConnecting(true);
  }
  useEffect(() => {
    if (!isConnecting) return;

    const handleMessage = (e: MessageEvent) => {
      if (e.data?.type === "SUPABASE_AUTH_CODE" && e.data.code) {
        setIsConnecting(false);
        doExchangeToken(e.data.code);
      }
    };
    window.addEventListener("message", handleMessage);

    const interval = setInterval(() => {
      const code = localStorage.getItem("supabase_auth_code");
      if (code) {
        localStorage.removeItem("supabase_auth_code");
        setIsConnecting(false);
        doExchangeToken(code);
      }
    }, 1000);

    return () => {
      window.removeEventListener("message", handleMessage);
      clearInterval(interval);
    };
  }, [isConnecting, form]);

  const isLoading = patQuery.isLoading || appQuery.isLoading;

  if (isLoading) {
    return (
      <Card className="w-full border-slate-200 dark:border-slate-800 shadow-sm">
        <CardHeader>
          <Skeleton className="h-8 w-64 mb-2" />
          <Skeleton className="h-4 w-full" />
        </CardHeader>
        <CardContent className="space-y-6">
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="w-full border-slate-200 dark:border-slate-800 shadow-sm">
      <CardHeader className="pb-4">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-slate-900 dark:bg-slate-100 rounded-lg text-white dark:text-slate-900">
            <Database className="h-5 w-5" />
          </div>
          <div className="flex-1">
            <h2 className="text-lg font-semibold leading-none tracking-tight">Supabase 项目访问配置</h2>
            <CardDescription className="text-sm mt-0.5">
              提供 Personal Access Token 或使用 OAuth 来管理项目的 Auth 设置。
            </CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            e.stopPropagation();
            form.handleSubmit();
          }}
          className="space-y-6"
        >
          <div className="space-y-4">
            <form.Field
              name="pat"
              children={(field) => (
                <Field className="gap-2.5">
                  <div className="flex items-center justify-between">
                    <FieldLabel>Personal Access Token (PAT)</FieldLabel>
                    <Link
                      href="https://supabase.com/dashboard/account/tokens"
                      target="_blank"
                      className="text-xs text-muted-foreground hover:text-foreground hover:underline underline-offset-4"
                    >
                      获取 PAT
                    </Link>
                  </div>
                  <PasswordInput
                    placeholder="sbp_..."
                    name={field.name}
                    value={field.state.value || ""}
                    onBlur={field.handleBlur}
                    onChange={(e) => field.handleChange(e.target.value)}
                    className="font-mono"
                  />
                  <p className="text-xs text-muted-foreground">用于一键同步 GitHub 凭据到 Supabase Auth。</p>
                  <FieldError errors={field.state.meta.errors} />
                </Field>
              )}
            />

            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <span className="w-full border-t" />
              </div>
              <div className="relative flex justify-center text-xs uppercase">
                <span className="bg-background px-2 text-muted-foreground text-xs">或使用 OAuth App</span>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <form.Field
                name="clientId"
                children={(field) => (
                  <Field className="gap-2.5">
                    <FieldLabel>Client ID</FieldLabel>
                    <Input
                      placeholder="Supabase App Client ID"
                      name={field.name}
                      value={field.state.value || ""}
                      onBlur={field.handleBlur}
                      onChange={(e) => field.handleChange(e.target.value)}
                    />
                    <FieldError errors={field.state.meta.errors} />
                  </Field>
                )}
              />
              <form.Field
                name="clientSecret"
                children={(field) => (
                  <Field className="gap-2.5">
                    <FieldLabel>Client Secret</FieldLabel>
                    <Input
                      type="password"
                      placeholder="Supabase App Client Secret"
                      name={field.name}
                      value={field.state.value || ""}
                      onBlur={field.handleBlur}
                      onChange={(e) => field.handleChange(e.target.value)}
                    />
                    <FieldError errors={field.state.meta.errors} />
                  </Field>
                )}
              />
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <Button
                type="button"
                variant="secondary"
                size="sm"
                onClick={handleAuthorize}
                disabled={!form.getFieldValue("clientId") || isConnecting || exchangeMutation.isPending}
              >
                {isConnecting || exchangeMutation.isPending ? "连接中..." : "通过 OAuth 授权"}
              </Button>

              <form.Subscribe
                selector={(state) => [state.canSubmit, state.isSubmitting, state.isDirty]}
                children={([canSubmit, isSubmitting, isDirty]) => (
                  <Button type="submit" size="sm" disabled={!canSubmit || isSubmitting || !isDirty}>
                    {isSubmitting ? "保存中..." : "保存配置"}
                  </Button>
                )}
              />
            </div>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
