import { z } from "zod";

export const TaskSchema = z.object({
  id: z.string(),
  created_at: z.string(),
  updated_at: z.string(),
  user_id: z.string(),
  title: z.string(),
  status: z.enum(["draft", "pending", "queued", "running", "completed", "failed", "cancelled", "paused"]),
  code_type: z.enum(["sql", "bash", "python", "agent"]).nullable(),
  executor_type: z.string().nullable(),
  completed_at: z.string().nullable().optional(),
  error: z.string().nullable().optional(),
  description: z.string().nullable().optional(),
  code: z.string().nullable().optional(),
  result: z.any().nullable().optional(),
  result_text: z.string().nullable().optional(),
  priority: z.number().optional().default(0),
  retry_count: z.number().optional().default(0),
  max_retries: z.number().optional().default(3),
  parent_id: z.string().nullable().optional(),
  context_type: z.string().nullable().optional(),
  context_id: z.string().nullable().optional(),
  executor_id: z.string().nullable().optional(),
  scheduled_at: z.string().nullable().optional(),
  started_at: z.string().nullable().optional(),
  meta: z.any().nullable().optional(),
  tags: z.any().nullable().optional(),
});

export type Task = z.infer<typeof TaskSchema>;
