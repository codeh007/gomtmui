import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useSupabaseBrowser } from "mtmsdk/supabase/context";
import { getRpcQueryKey, useRpcQuery } from "mtmsdk/supabase/use-sb-query/use-rpc-query";
import { toast } from "sonner";
import { z } from "zod";
import { JobQueueDlqItemSchema, JobQueueStatSchema } from "../schemas";

const JOB_QUEUE_NAMES = ["q_default", "q_system", "q_critical"] as const;

export const useJobQueueStats = () => {
  const defaultQueueQuery = useRpcQuery(
    "job_queue_list_dlq",
    { p_queue: "q_default", p_limit: 100, p_offset: 0 },
    { schema: z.array(JobQueueDlqItemSchema) },
  );
  const systemQueueQuery = useRpcQuery(
    "job_queue_list_dlq",
    { p_queue: "q_system", p_limit: 100, p_offset: 0 },
    { schema: z.array(JobQueueDlqItemSchema) },
  );
  const criticalQueueQuery = useRpcQuery(
    "job_queue_list_dlq",
    { p_queue: "q_critical", p_limit: 100, p_offset: 0 },
    { schema: z.array(JobQueueDlqItemSchema) },
  );

  const queries = [defaultQueueQuery, systemQueueQuery, criticalQueueQuery] as const;
  const data = JOB_QUEUE_NAMES.map((queueName, index) =>
    JobQueueStatSchema.parse({
      queue_name: queueName,
      msg_count: 0,
      dlq_count: queries[index].data?.length ?? 0,
    }),
  );

  return {
    data,
    isLoading: queries.some((query) => query.isLoading),
    error: queries.find((query) => query.error)?.error ?? null,
  };
};

export const useJobQueueDlqList = (queue: string, params: { limit: number; offset: number }) => {
  return useRpcQuery(
    "job_queue_list_dlq",
    {
      p_queue: queue,
      p_limit: params.limit,
      p_offset: params.offset,
    },
    {
      schema: z.array(JobQueueDlqItemSchema),
      queryKeySuffix: [queue, params.limit, params.offset],
    },
  );
};

export const useJobQueueRetryDlq = () => {
  const sb = useSupabaseBrowser();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ queue, msgIds }: { queue: string; msgIds: number[] }) => {
      const { error } = await sb.rpc("job_queue_retry_dlq", {
        p_queue: queue,
        p_msg_ids: msgIds,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: getRpcQueryKey("job_queue_list_dlq"),
      });
      toast.success("Tasks retried successfully");
    },
    onError: (err) => {
      toast.error(`Retry failed: ${err.message}`);
    },
  });
};

export const useJobQueuePurgeDlq = () => {
  const sb = useSupabaseBrowser();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ queue, msgIds }: { queue: string; msgIds: number[] }) => {
      const { error } = await sb.rpc("job_queue_purge_dlq", {
        p_queue: queue,
        p_msg_ids: msgIds,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: getRpcQueryKey("job_queue_list_dlq"),
      });
      toast.success("Tasks purged");
    },
    onError: (err) => {
      toast.error(`Purge failed: ${err.message}`);
    },
  });
};
