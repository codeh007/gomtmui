"use client";

import { useForm } from "@tanstack/react-form";
import { useQueryClient } from "@tanstack/react-query";
import { Globe, Loader2, Save } from "lucide-react";
import { domainConfigSchema } from "mtmsdk/supabase/schema/system-config";
import { useRpcMutation } from "mtmsdk/supabase/use-sb-query/use-rpc-mutation";
import { getRpcQueryKey, useRpcQuery } from "mtmsdk/supabase/use-sb-query/use-rpc-query";
import type { Json } from "mtmsdk/types/database.types";
import { Badge } from "mtxuilib/ui/badge";
import { Button } from "mtxuilib/ui/button";
import { Card, CardContent, CardDescription, CardHeader } from "mtxuilib/ui/card";
import { Input } from "mtxuilib/ui/input";
import { Label } from "mtxuilib/ui/label";
import { Skeleton } from "mtxuilib/ui/skeleton";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

interface DomainConfig {
  primary_domain: string;
  worker_subdomain_prefix: string;
}

const DEFAULT_CONFIG: DomainConfig = {
  primary_domain: "",
  worker_subdomain_prefix: "",
};

export function DomainConfigCard() {
  const [saving, setSaving] = useState(false);
  const queryClient = useQueryClient();

  const configQuery = useRpcQuery(
    "system_config_public_get",
    { p_key: "domain_config" },
    { schema: domainConfigSchema },
  );

  const setConfigMutation = useRpcMutation("system_config_public_set");
  const currentConfig = useMemo<DomainConfig>(() => {
    const data = configQuery.data;
    return {
      primary_domain: data?.primary_domain || DEFAULT_CONFIG.primary_domain,
      worker_subdomain_prefix: data?.worker_subdomain_prefix || DEFAULT_CONFIG.worker_subdomain_prefix,
    };
  }, [configQuery.data]);

  const isConfigured = useMemo(() => {
    const data = configQuery.data;
    return !!data?.primary_domain;
  }, [configQuery.data]);

  const form = useForm({
    defaultValues: currentConfig,
    onSubmit: async ({ value }) => {
      setSaving(true);
      try {
        const { error } = await setConfigMutation.mutateAsync({
          p_key: "domain_config",
          p_value: value as unknown as Json,
        });

        if (error) throw error;
        toast.success("域名配置保存成功");
        queryClient.invalidateQueries({ queryKey: getRpcQueryKey("system_config_public_get") });
        configQuery.refetch();
      } catch (err) {
        toast.error(`保存失败: ${err instanceof Error ? err.message : "未知错误"}`);
      } finally {
        setSaving(false);
      }
    },
  });
  useEffect(() => {
    if (configQuery.data) {
      form.reset();
    }
  }, [configQuery.data, form]);
  const handleReset = () => {
    form.reset();
  };

  if (configQuery.isLoading) {
    return (
      <Card className="w-full border-slate-200 dark:border-slate-800 shadow-sm">
        <CardHeader className="pb-4">
          <div className="flex items-center gap-3">
            <Skeleton className="h-9 w-9 rounded-lg" />
            <div className="flex-1 space-y-2">
              <Skeleton className="h-5 w-24" />
              <Skeleton className="h-4 w-48" />
            </div>
          </div>
        </CardHeader>
        <CardContent className="pt-0 space-y-4">
          <div className="space-y-2.5">
            <Skeleton className="h-4 w-16" />
            <Skeleton className="h-9 max-w-sm" />
            <Skeleton className="h-3 w-64" />
          </div>
          <div className="space-y-2.5">
            <Skeleton className="h-4 w-20" />
            <Skeleton className="h-9 max-w-xs" />
            <Skeleton className="h-3 w-40" />
          </div>
          <div className="flex items-center gap-2 pt-2">
            <Skeleton className="h-9 w-16" />
            <Skeleton className="h-9 w-16" />
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="w-full border-slate-200 dark:border-slate-800 shadow-sm">
      <CardHeader className="pb-4">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-blue-600 dark:bg-blue-500 rounded-lg text-white">
            <Globe className="h-5 w-5" />
          </div>
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <h2 className="text-lg font-semibold leading-none tracking-tight">域名配置</h2>
              {isConfigured && (
                <Badge variant="outline" className="text-emerald-600 border-emerald-500/30 text-xs">
                  已配置
                </Badge>
              )}
            </div>
            <CardDescription className="text-sm mt-0.5">
              配置系统主域名，用于自动生成 Worker 实例的公网域名
            </CardDescription>
          </div>
        </div>
      </CardHeader>

      <CardContent className="pt-0">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            e.stopPropagation();
            form.handleSubmit();
          }}
          className="space-y-4"
        >
          {/* 主域名 */}
          <form.Field name="primary_domain">
            {(field) => (
              <div className="space-y-2.5">
                <Label htmlFor={field.name} className="text-sm font-medium">
                  主域名 <span className="text-red-500">*</span>
                </Label>
                <Input
                  id={field.name}
                  value={field.state.value}
                  onBlur={field.handleBlur}
                  onChange={(e) => field.handleChange(e.target.value)}
                  placeholder="例如: example.com"
                  className="max-w-lg"
                />
                <p className="text-xs text-muted-foreground">
                  Worker 子域名将基于此域名生成，格式:{" "}
                  <code className="bg-muted px-1 rounded text-xs">[前缀][workerId].[主域名]</code>
                </p>
              </div>
            )}
          </form.Field>

          {/* Worker 子域名前缀 */}
          <form.Field name="worker_subdomain_prefix">
            {(field) => (
              <div className="space-y-2.5">
                <Label htmlFor={field.name} className="text-sm font-medium">
                  子域名前缀
                </Label>
                <Input
                  id={field.name}
                  value={field.state.value}
                  onBlur={field.handleBlur}
                  onChange={(e) => field.handleChange(e.target.value)}
                  placeholder="可选，例如: w-"
                  className="max-w-lg"
                />
                <p className="text-xs text-muted-foreground">可选的前缀，将自动添加到 Worker ID 前面</p>
              </div>
            )}
          </form.Field>

          {/* 操作按钮 */}
          <div className="flex items-center justify-end gap-2 pt-2">
            <Button type="submit" size="sm" disabled={saving}>
              {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
              保存配置
            </Button>
            <Button type="button" variant="ghost" size="sm" onClick={handleReset}>
              重置
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
