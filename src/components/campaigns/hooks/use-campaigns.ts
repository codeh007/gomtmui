import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useSupabaseBrowser } from "mtmsdk/supabase/context";
import { getRpcQueryKey, useRpcQuery } from "mtmsdk/supabase/use-sb-query/use-rpc-query";
import { z } from "zod";
import { type CampaignListParamsSchema, CampaignRecordSchema } from "../schemas";

export const useCampaignList = (params: z.input<typeof CampaignListParamsSchema> = {}) => {
  return useRpcQuery("campaign_list_cursor", params, {
    schema: z.array(CampaignRecordSchema),
  });
};

export const useCampaignGet = (id: string) => {
  return useRpcQuery(
    "campaign_get",
    { p_id: id },
    {
      schema: z.array(CampaignRecordSchema).transform((rows) => rows[0]),
      enabled: !!id,
    },
  );
};

export const useCampaignStart = () => {
  const queryClient = useQueryClient();
  const sb = useSupabaseBrowser();

  return useMutation({
    mutationFn: async (id: string) => {
      const { data, error } = await sb.rpc("campaign_start", { p_id: id });
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: getRpcQueryKey("campaign_list_cursor") });
      queryClient.invalidateQueries({ queryKey: getRpcQueryKey("campaign_get") });
    },
  });
};

export const useCampaignPause = () => {
  const queryClient = useQueryClient();
  const sb = useSupabaseBrowser();

  return useMutation({
    mutationFn: async (id: string) => {
      const { data, error } = await sb.rpc("campaign_pause", { p_id: id });
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: getRpcQueryKey("campaign_list_cursor") });
      queryClient.invalidateQueries({ queryKey: getRpcQueryKey("campaign_get") });
    },
  });
};
