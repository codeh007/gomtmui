"use client";

import { useForm } from "@tanstack/react-form";
import { Loader2, Save } from "lucide-react";
import { useRpcMutation } from "mtmsdk/supabase/use-sb-query/use-rpc-mutation";
import { Button } from "mtxuilib/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "mtxuilib/ui/card";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { ZodError } from "zod";

import {
  CampaignConfigSchema,
  CampaignFormSchema,
  type CampaignFormValues,
  type CampaignRecord,
  CampaignScheduleSchema,
  CampaignTargetFilterSchema,
  type CampaignUpsertParams,
  platformSchema,
} from "./schemas";
import { BasicInfoSection } from "./sections/BasicInfoSection";
import { ConfigurationSection } from "./sections/ConfigurationSection";
import { MessageTemplateSection } from "./sections/MessageTemplateSection";
import { TargetAudienceSection } from "./sections/TargetAudienceSection";

interface CampaignBuilderProps {
  initialData?: CampaignRecord;
  mode?: "create" | "edit";
}

export function CampaignBuilder({ initialData, mode = "create" }: CampaignBuilderProps) {
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const initialPlatformResult = platformSchema.safeParse(initialData?.platform);
  const initialPlatform: CampaignFormValues["platform"] = initialPlatformResult.success
    ? initialPlatformResult.data
    : "telegram";
  const initialConfig = CampaignConfigSchema.parse(initialData?.config ?? {});
  const initialSchedule = CampaignScheduleSchema.parse(initialData?.schedule ?? {});
  const initialTargetFilter = CampaignTargetFilterSchema.parse(initialData?.target_filter ?? {});

  const defaultValues: CampaignFormValues = {
    name: initialData?.name ?? "",
    description: initialData?.description ?? "",
    platform: initialPlatform,
    target_tags: initialTargetFilter.tags ?? [],
    message_template: initialData?.message_template || "你好 {name}, ",
    cloud_account_ids: initialConfig.cloud_account_ids,
    daily_limit_per_account: initialConfig.daily_limit_per_account,
    interval_min: initialConfig.interval_seconds[0],
    interval_max: initialConfig.interval_seconds[1],
    schedule_enabled: initialSchedule.enabled,
    time_windows: initialSchedule.time_windows,
    days_of_week: initialSchedule.days_of_week,
    account_strategy: initialConfig.account_strategy,
    retry_on_failure: initialConfig.retry_on_failure,
    max_retries: initialConfig.max_retries,
  };

  const upsertMutation = useRpcMutation("campaign_upsert");

  const form = useForm({
    defaultValues,
    onSubmit: async ({ value }) => {
      setIsSubmitting(true);
      try {
        CampaignFormSchema.parse(value);

        const campaignData: CampaignUpsertParams = {
          p_id: initialData?.id, // Pass ID if editing
          p_name: value.name,
          p_description: value.description,
          p_platform: value.platform,
          p_message_template: value.message_template,
          p_target_filter: {
            ...initialTargetFilter,
            tags: value.target_tags.length > 0 ? value.target_tags : undefined,
            status: initialTargetFilter.status ?? "active",
          },
          p_config: {
            ...initialConfig,
            cloud_account_ids: value.cloud_account_ids,
            account_strategy: value.account_strategy,
            daily_limit_per_account: value.daily_limit_per_account,
            interval_seconds: [value.interval_min, value.interval_max],
            retry_on_failure: value.retry_on_failure,
            max_retries: value.max_retries,
          },
          p_schedule: {
            ...initialSchedule,
            enabled: value.schedule_enabled,
            time_windows: value.time_windows,
            days_of_week: value.days_of_week,
          },
        };

        const result = await upsertMutation.mutateAsync(campaignData);

        if (result.data && result.data.length > 0) {
          toast.success(mode === "create" ? "活动创建成功" : "活动更新成功");
          router.push(`/dash/campaigns`);
        } else {
          toast.error("操作失败: 无返回ID");
        }
      } catch (error) {
        if (error instanceof ZodError) {
          toast.error(error.issues?.[0]?.message || error.message);
        } else {
          toast.error(`提交失败: ${(error as Error).message}`);
        }
      } finally {
        setIsSubmitting(false);
      }
    },
  });

  return (
    <div className="mx-auto max-w-4xl space-y-8 py-8">
      <div className="flex items-center justify-between">
        <div className="space-y-1">
          <h1 className="text-2xl font-bold tracking-tight">{mode === "create" ? "创建推广活动" : "编辑推广活动"}</h1>
          <p className="text-muted-foreground">
            {mode === "create" ? "配置活动信息，筛选目标受众并设置发送策略。" : "修改活动配置信息。"}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={() => router.back()} type="button">
            取消
          </Button>
          <Button
            type="button"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              form.handleSubmit();
            }}
            disabled={isSubmitting}
          >
            {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
            {mode === "create" ? "创建活动" : "保存修改"}
          </Button>
        </div>
      </div>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          e.stopPropagation();
          form.handleSubmit();
        }}
        className="space-y-8"
      >
        <Card>
          <CardHeader>
            <CardTitle>基本信息</CardTitle>
            <CardDescription>活动名称与描述</CardDescription>
          </CardHeader>
          <CardContent>
            <BasicInfoSection form={form} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>目标受众</CardTitle>
            <CardDescription>筛选联系人</CardDescription>
          </CardHeader>
          <CardContent>
            <TargetAudienceSection form={form} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>消息内容</CardTitle>
            <CardDescription>编辑推广文案</CardDescription>
          </CardHeader>
          <CardContent>
            <MessageTemplateSection form={form} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>发送配置</CardTitle>
            <CardDescription>账号与频率设置</CardDescription>
          </CardHeader>
          <CardContent>
            <ConfigurationSection form={form} />
          </CardContent>
        </Card>
      </form>
    </div>
  );
}
