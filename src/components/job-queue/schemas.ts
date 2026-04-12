import { z } from "zod";

export const JobQueueStatSchema = z.object({
  queue_name: z.string(),
  msg_count: z.number().or(z.string().transform(Number)), // bigint returned as string sometimes?
  dlq_count: z.number().or(z.string().transform(Number)),
});

export type JobQueueStat = z.infer<typeof JobQueueStatSchema>;

export const JobQueueDlqItemSchema = z.object({
  msg_id: z.string().or(z.number()), // bigint
  read_ct: z.number(),
  enqueued_at: z.string(),
  message: z.any(), // jsonb
});

export type JobQueueDlqItem = z.infer<typeof JobQueueDlqItemSchema>;
