import { z } from "zod";

// Cloud Account Status Enum
export const CloudAccountStatusEnum = z.enum([
  "pending",
  "active",
  "token_expired",
  "needs_reauth",
  "quota_exceeded",
  "suspended",
  "disabled",
]);

export type CloudAccountStatus = z.infer<typeof CloudAccountStatusEnum>;

// Telegram Credentials Schema
export const TelegramCredentialsSchema = z.object({
  api_id: z.number().optional().nullable(),
  api_hash: z.string().optional().nullable(),
  session_string: z.string().optional().nullable(),
  phone_number: z.string().optional().nullable(),
  user_id: z.string().optional(), // Use string to handle large integers safely
  dc_id: z.number().optional().nullable(),
  username: z.string().optional().nullable(),
  first_name: z.string().optional().nullable(),
  last_name: z.string().optional().nullable(),
  created_at: z.string().optional(),
  last_verified_at: z.string().optional(),
  has_2fa: z.boolean().optional(),
});

export type TelegramCredentials = z.infer<typeof TelegramCredentialsSchema>;

export const DeviceHistoryItemSchema = z.object({
  id: z.uuid(),
  profile: z.record(z.string(), z.any()).nullable().optional(),
  created_at: z.number().nullable().optional(),
  label: z.string().nullable().optional(),
  is_current: z.boolean().nullable().optional(),
});

export type DeviceHistoryItem = z.infer<typeof DeviceHistoryItemSchema>;

// Cloud Account Record Schema
// Matching database type: public.cloud_account_record
// Note: We use z.string() for IDs even if DB says string|null because effectively they are required in the app.
export const CloudAccountRecordSchema = z.object({
  id: z.string(),
  created_at: z.string().nullable().optional(),
  updated_at: z.string().nullable().optional(),
  user_id: z.string(),
  platform_name: z.string(),
  account_email: z.email().nullable().optional(),
  account_name: z.string().nullable().optional(),
  token_type: z.string().nullable().optional(),
  token_expires_at: z.string().nullable().optional(),
  refresh_token_expires_at: z.string().nullable().optional(),
  last_refresh_at: z.string().nullable().optional(),
  status: CloudAccountStatusEnum.nullable().optional(),
  status_reason: z.string().nullable().optional(),
  status_updated_at: z.string().nullable().optional(),
  session_data: z.record(z.string(), z.any()).nullable().optional(), // jsonb
  device_fingerprint: z.record(z.string(), z.any()).nullable().optional(), // jsonb
  device_history: z.array(DeviceHistoryItemSchema).nullable().optional(), // jsonb[]
  quota_data: z.record(z.string(), z.any()).nullable().optional(), // jsonb
  metadata: z.record(z.string(), z.any()).nullable().optional(), // jsonb
  credentials: z
    .union([TelegramCredentialsSchema, z.record(z.string(), z.any())])
    .nullable()
    .optional(), // jsonb
  proxy_disabled: z.boolean().nullable().optional(),
  last_used_at: z.string().nullable().optional(),
  use_count: z.number().nullable().optional(), // bigint usually comes as number or string from JS client
  automation_config: z.record(z.string(), z.any()).nullable().optional(), // jsonb
});

export type CloudAccountRecord = z.infer<typeof CloudAccountRecordSchema>;

// Alias for convenience (similar to Front-end domain model)
export const CloudAccountSchema = CloudAccountRecordSchema;
export type CloudAccount = CloudAccountRecord;
