"use client";

import { useForm } from "@tanstack/react-form";
import { useQueryClient } from "@tanstack/react-query";
import { CloudIcon } from "lucide-react";
import { useRpcMutation } from "mtmsdk/supabase/use-sb-query/use-rpc-mutation";
import { getRpcQueryKey, useRpcQuery } from "mtmsdk/supabase/use-sb-query/use-rpc-query";
import { PasswordInput } from "mtxuilib/mt/inputs/password-input";
import { Button } from "mtxuilib/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "mtxuilib/ui/card";
import { Field, FieldError, FieldLabel } from "mtxuilib/ui/field";
import { Input } from "mtxuilib/ui/input";
import { Skeleton } from "mtxuilib/ui/skeleton";
import { toast } from "sonner";
import z from "zod";

const cloudflareConfigSchema = z
  .object({
    account_id: z.string().min(1, "Account ID 必填"),
    api_token: z.string().min(1, "API Token 必填"),
    zone_id: z.string().optional(),
  })
  .nullable()
  .optional();

export function CloudflareConfigCard() {
  const queryClient = useQueryClient();

  // Fetch existing config from sys_config (Private)
  const configQuery = useRpcQuery("sys_config_get", { p_key: "cloudflare_config" }, { schema: cloudflareConfigSchema });

  const saveMutation = useRpcMutation("sys_config_set", {
    onSuccess: (result) => {
      if (result.error) {
        toast.error("保存失败", { description: result.error.message });
        return;
      }
      toast.success("Cloudflare 凭据已保存");
      void queryClient.invalidateQueries({ queryKey: getRpcQueryKey("sys_config_get") });
    },
    onError: (error) => {
      toast.error("保存失败", { description: error.message });
    },
  });

  const form = useForm({
    defaultValues: {
      account_id: configQuery.data?.account_id || "",
      api_token: configQuery.data?.api_token || "",
      zone_id: configQuery.data?.zone_id || "",
    },
    onSubmit: async ({ value }) => {
      saveMutation.mutate({
        p_key: "cloudflare_config",
        p_value: value,
        p_description: "Cloudflare API 凭据 (Account ID, Token)",
      });
    },
  });

  if (configQuery.isLoading) {
    return (
      <Card className="w-full border-slate-200 dark:border-slate-800 shadow-sm">
        <CardHeader className="pb-4">
          <div className="flex items-center gap-3">
            <Skeleton className="h-9 w-9 rounded-lg" />
            <div className="flex-1 space-y-2">
              <Skeleton className="h-5 w-36" />
              <Skeleton className="h-4 w-64" />
            </div>
          </div>
        </CardHeader>
        <CardContent className="pt-0 space-y-4">
          <div className="space-y-2">
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-9 max-w-lg" />
          </div>
          <div className="space-y-2">
            <Skeleton className="h-4 w-28" />
            <Skeleton className="h-9 max-w-lg" />
            <Skeleton className="h-3 w-64" />
          </div>
          <div className="space-y-2">
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-9 max-w-lg" />
            <Skeleton className="h-3 w-56" />
          </div>
          <div className="flex justify-end">
            <Skeleton className="h-9 w-24" />
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="w-full border-slate-200 dark:border-slate-800 shadow-sm">
      <CardHeader className="pb-4">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-orange-500 rounded-lg text-white">
            <CloudIcon className="h-5 w-5" />
          </div>
          <div className="flex-1">
            <CardTitle className="text-lg font-semibold">Cloudflare 凭据配置</CardTitle>
            <CardDescription className="text-sm mt-0.5">
              配置 Cloudflare Account ID 和 API Token。域名配置请使用上方的"域名配置"卡片。
            </CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <form
          key={configQuery.data?.account_id} // Remount when data loads
          onSubmit={(e) => {
            e.preventDefault();
            e.stopPropagation();
            form.handleSubmit();
          }}
          className="space-y-4"
        >
          {/* Account ID */}
          <form.Field
            name="account_id"
            children={(field) => (
              <Field className="gap-2.5">
                <FieldLabel>Account ID</FieldLabel>
                <Input
                  name={field.name}
                  value={field.state.value}
                  onBlur={field.handleBlur}
                  onChange={(e) => field.handleChange(e.target.value)}
                  placeholder="623faf72ee0d..."
                  className="max-w-lg"
                />
                <FieldError errors={field.state.meta.errors} />
              </Field>
            )}
          />

          {/* API Token */}
          <form.Field
            name="api_token"
            children={(field) => (
              <Field className="gap-2.5">
                <FieldLabel>API Token</FieldLabel>
                <PasswordInput
                  name={field.name}
                  value={field.state.value}
                  onBlur={field.handleBlur}
                  onChange={(e) => field.handleChange(e.target.value)}
                  placeholder="uKelPK68..."
                  className="max-w-lg"
                />
                <p className="text-xs text-muted-foreground">
                  需要 Account:Cloudflare Tunnel:Edit 和 Zone:DNS:Edit 权限
                </p>
                <FieldError errors={field.state.meta.errors} />
              </Field>
            )}
          />

          {/* Zone ID */}
          <form.Field
            name="zone_id"
            children={(field) => (
              <Field className="gap-2.5">
                <FieldLabel>Zone ID (可选)</FieldLabel>
                <Input
                  name={field.name}
                  value={field.state.value}
                  onBlur={field.handleBlur}
                  onChange={(e) => field.handleChange(e.target.value)}
                  placeholder="可选，留空自动获取"
                  className="max-w-lg"
                />
                <p className="text-xs text-muted-foreground">
                  通常不需要手动填写，gomtmui 内联的 mtgate API 会通过 API Token 自动获取。
                </p>
              </Field>
            )}
          />

          <div className="flex justify-end">
            <Button type="submit" size="sm">
              保存配置
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
