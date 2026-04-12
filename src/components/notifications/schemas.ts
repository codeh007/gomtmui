import { z } from "zod";

export const NotificationTypeEnum = z.enum(["info", "warning", "error", "action_required"]);
export type NotificationType = z.infer<typeof NotificationTypeEnum>;

export const NotificationPriorityEnum = z.enum(["low", "normal", "high", "urgent"]);
export type NotificationPriority = z.infer<typeof NotificationPriorityEnum>;

export const NotificationSourceTypeEnum = z.enum(["cloud_account", "server", "agent", "system"]);
export type NotificationSourceType = z.infer<typeof NotificationSourceTypeEnum>;

export const NotificationActionTypeEnum = z.enum([
  "telegram_verify_code",
  "telegram_2fa",
  "confirm",
  "approve",
  "reject",
  "system_alert",
  "retry_job",
  "view_trace",
  "link",
]);
export type NotificationActionType = z.infer<typeof NotificationActionTypeEnum>;

export const UserNotificationRecordSchema = z.object({
  id: z.uuid(),
  created_at: z.string().nullable(),
  updated_at: z.string().nullable(),
  user_id: z.uuid().nullable(),
  title: z.string().nullable(),
  message: z.string().nullable(),
  notification_type: z.string().nullable(),
  priority: z.string().nullable(),
  source_type: z.string().nullable(),
  source_id: z.string().nullable(),
  action_type: z.string().nullable(),
  action_payload: z.record(z.string(), z.unknown()).nullable(),
  action_completed_at: z.string().nullable(),
  is_read: z.boolean().nullable(),
  read_at: z.string().nullable(),
  dismissed_at: z.string().nullable(),
  expires_at: z.string().nullable(),
});

export type UserNotificationRecord = z.infer<typeof UserNotificationRecordSchema>;

export const CreateNotificationParamsSchema = z.object({
  p_user_id: z.uuid(),
  p_title: z.string(),
  p_message: z.string().optional(),
  p_type: NotificationTypeEnum.optional().default("info"),
  p_priority: NotificationPriorityEnum.optional().default("normal"),
  p_source_type: NotificationSourceTypeEnum.optional(),
  p_source_id: z.string().optional(),
  p_action_type: NotificationActionTypeEnum.optional(),
  p_action_payload: z.record(z.string(), z.unknown()).optional(),
  p_expires_in: z.string().optional(),
});

export type CreateNotificationParams = z.infer<typeof CreateNotificationParamsSchema>;
export const NotificationListParamsSchema = z.object({
  p_limit: z.number().optional().default(20),
  p_cursor: z.string().optional(),
  p_unread_only: z.boolean().optional().default(false),
  p_include_dismissed: z.boolean().optional().default(false),
  p_source_type: z.string().optional(),
  p_action_type: z.string().optional(),
});

export type NotificationListParams = z.infer<typeof NotificationListParamsSchema>;

export interface TelegramVerifyCodePayload {
  account_id: string;
  timeout: number;
  code_type?: string;
}

export interface TelegramTwoFAPayload {
  account_id: string;
}

export interface ConfirmPayload {
  action: string;
  resource_type?: string;
  resource_id?: string;
}

export interface RetryJobPayload {
  job_id: string;
  queue: string;
}

export interface ViewTracePayload {
  trace_id: string;
}

export interface LinkPayload {
  url: string;
}

export function isTelegramVerifyCodeNotification(
  notification: UserNotificationRecord,
): notification is UserNotificationRecord & { action_payload: TelegramVerifyCodePayload } {
  return notification.action_type === "telegram_verify_code";
}

export function isTelegramTwoFANotification(
  notification: UserNotificationRecord,
): notification is UserNotificationRecord & { action_payload: TelegramTwoFAPayload } {
  return notification.action_type === "telegram_2fa";
}

export function isLinkNotification(
  notification: UserNotificationRecord,
): notification is UserNotificationRecord & { action_payload: LinkPayload } {
  return notification.action_type === "link";
}

export function isActionRequiredNotification(notification: UserNotificationRecord): boolean {
  return (
    notification.notification_type === "action_required" &&
    notification.action_type !== null &&
    notification.action_completed_at === null
  );
}
