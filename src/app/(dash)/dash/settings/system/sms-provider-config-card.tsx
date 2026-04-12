"use client";

import { useForm } from "@tanstack/react-form";
import { Loader2, MessageSquare, Save } from "lucide-react";
import { smsProviderConfigSchema } from "mtmsdk/supabase/schema/system-config";
import { useRpcMutation } from "mtmsdk/supabase/use-sb-query/use-rpc-mutation";
import { useRpcQuery } from "mtmsdk/supabase/use-sb-query/use-rpc-query";
import type { Json } from "mtmsdk/types/database.types";
import { Button } from "mtxuilib/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "mtxuilib/ui/card";
import { Label } from "mtxuilib/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "mtxuilib/ui/select";
import { Skeleton } from "mtxuilib/ui/skeleton";
import { useEffect, useMemo } from "react";
import { toast } from "sonner";
import type { z } from "zod";

type SmsProviderConfig = z.infer<typeof smsProviderConfigSchema>;

const DEFAULT_CONFIG: SmsProviderConfig = {
  default_provider: "manual",
};

const smsProviderConfigQuerySchema = smsProviderConfigSchema.nullable().transform((data) => data ?? DEFAULT_CONFIG);

export function SmsProviderConfigCard() {
  // Use sys_config_get
  const configQuery = useRpcQuery(
    "sys_config_get",
    { p_key: "sms_provider_config" },
    { schema: smsProviderConfigQuerySchema },
  );

  const setConfigMutation = useRpcMutation("sys_config_set", {
    onSuccess: () => {
      toast.success("配置已保存");
      void configQuery.refetch();
    },
    onError: (err) => {
      toast.error(`保存失败: ${err instanceof Error ? err.message : "未知错误"}`);
    },
  });

  const currentConfig = useMemo<SmsProviderConfig>(() => {
    const data = configQuery.data;
    if (!data) return DEFAULT_CONFIG;
    return {
      default_provider: data.default_provider,
    };
  }, [configQuery.data]);

  const form = useForm({
    defaultValues: currentConfig,
    onSubmit: async ({ value }) => {
      const payload = { ...value };
      await setConfigMutation.mutateAsync({
        p_key: "sms_provider_config",
        p_value: payload as unknown as Json,
        p_description: "SMS Provider Configuration",
      });
    },
  });

  useEffect(() => {
    if (configQuery.data) {
      form.reset(configQuery.data);
    }
  }, [configQuery.data, form]);

  const saving = setConfigMutation.isPending;

  if (configQuery.isLoading) {
    return (
      <Card className="w-full border-slate-200 dark:border-slate-800 shadow-sm">
        <CardHeader className="pb-4">
          <Skeleton className="h-8 w-48" />
        </CardHeader>
        <CardContent className="space-y-4">
          <Skeleton className="h-24 w-full" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="w-full border-slate-200 dark:border-slate-800 shadow-sm">
      <CardHeader className="pb-4">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-indigo-600 dark:bg-indigo-500 rounded-lg text-white">
            <MessageSquare className="h-5 w-5" />
          </div>
          <div className="flex-1">
            <CardTitle className="text-lg font-semibold">短信接码配置 (SMS Provider)</CardTitle>
            <CardDescription className="text-sm mt-0.5">设置系统默认的短信验证码接收方式。</CardDescription>
          </div>
        </div>
      </CardHeader>

      <CardContent className="pt-0 space-y-8">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            e.stopPropagation();
            form.handleSubmit();
          }}
          className="space-y-8"
        >
          <div className="space-y-4">
            <div className="pl-1">
              <form.Field name="default_provider">
                {(field) => (
                  <div className="space-y-2.5">
                    <Label htmlFor="default_provider_select" className="text-sm font-medium">
                      默认接码方式
                    </Label>
                    <Select
                      value={field.state.value}
                      onValueChange={(val: "manual" | "demo") => field.handleChange(val)}
                    >
                      <SelectTrigger id="default_provider_select" className="max-w-lg">
                        <SelectValue placeholder="Select provider" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="manual">人工输入 (Manual)</SelectItem>
                        <SelectItem value="demo">演示 (Demo)</SelectItem>
                      </SelectContent>
                    </Select>
                    <p className="text-xs text-muted-foreground">设置系统默认的短信验证码接收方式。</p>
                  </div>
                )}
              </form.Field>
            </div>
          </div>

          <div className="flex items-center justify-end gap-2 pt-4">
            <Button type="submit" size="sm" disabled={saving}>
              {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
              保存配置
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
