import { useInfiniteQuery } from "@tanstack/react-query";
import { useSupabaseBrowser } from "mtmsdk/supabase/context";
import { getRpcQueryKey } from "mtmsdk/supabase/use-sb-query/use-rpc-query";
import { z } from "zod";
import { CloudAccountRecordSchema, type CloudAccountStatus } from "../schemas";

export function useCloudAccounts({
  pageSize = 20,
  kw = "",
  platformName,
  status,
  enabled = true,
}: {
  pageSize?: number;
  kw?: string;
  platformName?: string;
  status?: CloudAccountStatus;
  enabled?: boolean;
} = {}) {
  const sb = useSupabaseBrowser();

  return useInfiniteQuery({
    queryKey: [...getRpcQueryKey("cloud_account_list_cursor"), { pageSize, kw, platformName, status }],
    queryFn: async ({ pageParam }) => {
      const cursor = pageParam as string | undefined;

      const { data, error } = await sb.rpc("cloud_account_list_cursor", {
        p_cursor: cursor || undefined,
        p_limit: pageSize,
        p_search: kw || undefined,
        p_platform_name: platformName || undefined,
        p_status: status || undefined,
      });

      if (error) throw error;

      return z.array(CloudAccountRecordSchema).parse(data);
    },
    getNextPageParam: (lastPage) => {
      if (!lastPage || lastPage.length < pageSize) return undefined;
      const lastItem = lastPage[lastPage.length - 1];
      if (!lastItem.updated_at) return undefined;

      return lastItem.updated_at;
    },
    initialPageParam: undefined as string | undefined,
    enabled,
  });
}
