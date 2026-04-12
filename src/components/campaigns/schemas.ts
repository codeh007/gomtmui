import type { ReactFormExtendedApi } from "@tanstack/react-form";
import { jsonSchema } from "mtmsdk/types/database.schemas";
import { z } from "zod";
export const CampaignStatusEnum = z.enum(["draft", "active", "paused", "completed"]);
export type CampaignStatus = z.infer<typeof CampaignStatusEnum>;
const jsonObjectValueSchema = z.union([jsonSchema, z.undefined()]);

export const CampaignConfigSchema = z
  .object({
    cloud_account_ids: z.array(z.uuid()).optional().default([]),
    account_strategy: z.enum(["round_robin", "random", "sequential"]).optional().default("round_robin"),
    daily_limit_per_account: z.number().int().min(1).optional().default(50),
    interval_seconds: z.tuple([z.number(), z.number()]).optional().default([60, 180]),
    retry_on_failure: z.boolean().optional().default(true),
    max_retries: z.number().int().min(0).optional().default(3),
  })
  .catchall(jsonObjectValueSchema);
export type CampaignConfig = z.infer<typeof CampaignConfigSchema>;

export const MessageTemplateSchema = z.string().optional();

export const CampaignTargetFilterSchema = z
  .object({
    tags: z.array(z.string()).optional(),
    status: z.string().optional(),
    source: z.string().optional(),
    exclude_tags: z.array(z.string()).optional(),
  })
  .catchall(jsonObjectValueSchema);
export type CampaignTargetFilter = z.infer<typeof CampaignTargetFilterSchema>;

export const CampaignScheduleSchema = z
  .object({
    enabled: z.boolean().optional().default(true),
    time_windows: z
      .array(
        z.object({
          start: z.string().regex(/^\d{2}:\d{2}$/, "格式必须为 HH:MM"),
          end: z.string().regex(/^\d{2}:\d{2}$/, "格式必须为 HH:MM"),
        }),
      )
      .optional()
      .default([{ start: "09:00", end: "18:00" }]),
    timezone: z.string().optional().default("Asia/Shanghai"),
    days_of_week: z.array(z.number().min(0).max(6)).optional().default([1, 2, 3, 4, 5]), // 0=Sun, 6=Sat
  })
  .catchall(jsonObjectValueSchema);
export type CampaignSchedule = z.infer<typeof CampaignScheduleSchema>;

export const CampaignStatsSchema = z.object({
  total_tasks: z.number().int().optional().default(0),
  sent_count: z.number().int().optional().default(0),
  success_count: z.number().int().optional().default(0),
  fail_count: z.number().int().optional().default(0),
  reply_count: z.number().int().optional().default(0),
});
export type CampaignStats = z.infer<typeof CampaignStatsSchema>;

export const CampaignRecordSchema = z.object({
  id: z.uuid(),
  created_at: z.string().nullable(),
  updated_at: z.string().nullable(),
  started_at: z.string().nullable(),
  completed_at: z.string().nullable(),
  user_id: z.uuid().nullable(),
  name: z.string().nullable(),
  description: z.string().nullable(),
  platform: z.string().nullable(),
  status: z.string().nullable(), // CampaignStatusEnum
  config: CampaignConfigSchema.nullable(),
  message_template: z.string().nullable(),
  target_filter: CampaignTargetFilterSchema.nullable(),
  schedule: CampaignScheduleSchema.nullable(),
  stats: CampaignStatsSchema.nullable(),
});

export type CampaignRecord = z.infer<typeof CampaignRecordSchema>;

export const CampaignListParamsSchema = z.object({
  p_limit: z.number().optional().default(20),
  p_cursor: z.string().optional(),
  p_status: z.string().optional(),
  p_search: z.string().optional(),
});

export type CampaignListParams = z.infer<typeof CampaignListParamsSchema>;

export const CampaignGetParamsSchema = z.object({
  p_id: z.uuid(),
});

export type CampaignGetParams = z.infer<typeof CampaignGetParamsSchema>;

export const platformSchema = z.enum(["telegram", "whatsapp"], { message: "请选择有效的平台" });

export const CampaignUpsertParamsSchema = z.object({
  p_id: z.uuid().optional(),
  p_name: z.string().min(1, "活动名称不能为空"),
  p_description: z.string().optional(),
  p_platform: platformSchema.optional().default("telegram"),
  p_config: CampaignConfigSchema.optional(),
  p_message_template: z.string().optional(),
  p_target_filter: CampaignTargetFilterSchema.optional(),
  p_schedule: CampaignScheduleSchema.optional(),
});

export type CampaignUpsertParams = z.infer<typeof CampaignUpsertParamsSchema>;

// 字段级验证规则
export const campaignNameSchema = z.string().min(1, "请输入活动名称").max(100, "活动名称不超过 100 字");
export const campaignDescriptionSchema = z.string().max(500, "描述不超过 500 字").optional();
export const targetTagsSchema = z.array(z.string()).min(0);
export const messageTemplateSchema = z.string().min(1, "请输入消息内容").max(2000, "消息内容不超过 2000 字");
export const cloudAccountIdsSchema = z.array(z.uuid()).min(1, "请至少选择一个发送账号");
export const dailyLimitSchema = z.number().int().min(1, "每日限制至少为 1").max(10000, "每日限制不超过 10000");
export const intervalMinSchema = z.number().int().min(1, "最小间隔至少为 1 秒");
export const intervalMaxSchema = z.number().int().min(1, "最大间隔至少为 1 秒");
export const scheduleEnabledSchema = z.boolean();
export const timeWindowSchema = z.object({
  start: z.string().regex(/^\d{2}:\d{2}$/, "格式必须为 HH:MM"),
  end: z.string().regex(/^\d{2}:\d{2}$/, "格式必须为 HH:MM"),
});
export const timeWindowsSchema = z.array(timeWindowSchema).min(1, "至少需要一个时间窗口");
export const daysOfWeekSchema = z.array(z.number().min(0).max(6)).min(1, "至少选择一天");
export const accountStrategySchema = z.enum(["round_robin", "random", "sequential"], {
  message: "请选择有效的账号策略",
});
export const retryOnFailureSchema = z.boolean();
export const maxRetriesSchema = z.number().int().min(0, "重试次数不能为负").max(10, "重试次数不超过 10");

export const CampaignFormSchema = z.object({
  name: campaignNameSchema,
  description: campaignDescriptionSchema,
  platform: platformSchema,
  target_tags: targetTagsSchema,
  message_template: messageTemplateSchema,
  cloud_account_ids: cloudAccountIdsSchema,
  daily_limit_per_account: dailyLimitSchema,
  interval_min: intervalMinSchema,
  interval_max: intervalMaxSchema,
  schedule_enabled: scheduleEnabledSchema,
  time_windows: timeWindowsSchema,
  days_of_week: daysOfWeekSchema,
  account_strategy: accountStrategySchema,
  retry_on_failure: retryOnFailureSchema,
  max_retries: maxRetriesSchema,
});

export type CampaignFormValues = z.infer<typeof CampaignFormSchema>;

type FormSectionApi<TFormData> = Pick<
  ReactFormExtendedApi<TFormData, any, any, any, any, any, any, any, any, any, any, any>,
  "Field" | "Subscribe"
>;

export type CampaignFormApi = FormSectionApi<CampaignFormValues>;
