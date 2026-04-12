/**
 * CRM 联系人管理 - Zod Schemas
 * 参考: docs/reports/crm-social-outreach-design.md#321-contacts---目标联系人表
 */
import { z } from "zod";

// 联系人状态枚举
export const ContactStatusEnum = z.enum(["active", "blocked", "invalid"]);
export type ContactStatus = z.infer<typeof ContactStatusEnum>;

// 联系人来源枚举
export const ContactSourceEnum = z.enum(["manual", "csv", "scrape"]);
export type ContactSource = z.infer<typeof ContactSourceEnum>;

// 联系人记录 Schema (匹配数据库 contact_record 复合类型)
export const ContactRecordSchema = z.object({
  id: z.uuid(),
  created_at: z.string().nullable(),
  updated_at: z.string().nullable(),
  user_id: z.uuid().nullable(),
  name: z.string().nullable(),
  phone: z.string().nullable(),
  telegram_id: z.number().nullable(),
  telegram_username: z.string().nullable(),
  email: z.string().nullable(),
  platform: z.string().nullable(),
  source: z.string().nullable(),
  tags: z.array(z.string()).nullable(),
  status: z.string().nullable(),
  metadata: z.record(z.string(), z.unknown()).nullable(),
});

export type ContactRecord = z.infer<typeof ContactRecordSchema>;

// 联系人列表查询参数
export const ContactListParamsSchema = z.object({
  p_limit: z.number().optional().default(20),
  p_cursor: z.string().optional(),
  p_platform: z.string().optional(),
  p_status: z.string().optional(),
  p_tags: z.array(z.string()).optional(),
  p_search: z.string().optional(),
});

export type ContactListParams = z.infer<typeof ContactListParamsSchema>;

// 联系人查询参数
export const ContactGetParamsSchema = z.object({
  p_id: z.uuid().optional(),
  p_phone: z.string().optional(),
  p_platform: z.string().optional(),
  p_telegram_id: z.number().optional(),
});

export type ContactGetParams = z.infer<typeof ContactGetParamsSchema>;

// 联系人创建/更新参数
export const ContactUpsertParamsSchema = z.object({
  p_id: z.uuid().optional(),
  p_name: z.string().optional(),
  p_phone: z.string().optional(),
  p_telegram_id: z.number().optional(),
  p_telegram_username: z.string().optional(),
  p_email: z.email().optional(),
  p_platform: z.string().optional().default("telegram"),
  p_source: z.string().optional().default("manual"),
  p_tags: z.array(z.string()).optional(),
  p_status: ContactStatusEnum.optional(),
  p_metadata: z.record(z.string(), z.unknown()).optional(),
});

export type ContactUpsertParams = z.infer<typeof ContactUpsertParamsSchema>;

// 批量导入参数
export const ContactBulkImportParamsSchema = z.object({
  p_contacts: z.array(
    z.object({
      phone: z.string(),
      name: z.string().optional(),
      telegram_id: z.number().optional(),
      telegram_username: z.string().optional(),
      email: z.string().optional(),
      tags: z.array(z.string()).optional(),
    }),
  ),
  p_platform: z.string().optional().default("telegram"),
  p_source: z.string().optional().default("csv"),
  p_default_tags: z.array(z.string()).optional().default([]),
});

export type ContactBulkImportParams = z.infer<typeof ContactBulkImportParamsSchema>;

// CSV 导入行结构 (前端解析 CSV 后的中间结构)
export const CsvContactRowSchema = z.object({
  phone: z.string().min(1, "手机号不能为空"),
  name: z.string().optional(),
  telegram_username: z.string().optional(),
  email: z.email().optional().or(z.literal("")),
  tags: z.string().optional(), // CSV 中以逗号分隔的标签字符串
});

export type CsvContactRow = z.infer<typeof CsvContactRowSchema>;
