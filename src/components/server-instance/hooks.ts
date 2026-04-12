import { type InfiniteData, useInfiniteQuery } from "@tanstack/react-query";
import { useSupabaseBrowser } from "mtmsdk/supabase/context";
import { getRpcQueryKey, useRpcQuery } from "mtmsdk/supabase/use-sb-query/use-rpc-query";
import { type ServerInstanceStatusDto, serverInstanceDetailSchema, serverInstanceListSchema } from "./status-contract";

export const SERVER_INSTANCE_POLL_MS = 3000;
export const SERVER_INSTANCE_TRANSITION_POLL_STATUSES = ["bootstrapping"] as const;
export const SERVER_INSTANCE_IDLE_POLL_MS = 10000;

export function shouldPollServerInstance(record: Pick<ServerInstanceStatusDto, "status">) {
  const status = record.status;
  return SERVER_INSTANCE_TRANSITION_POLL_STATUSES.includes(
    status as (typeof SERVER_INSTANCE_TRANSITION_POLL_STATUSES)[number],
  );
}

export function getServerInstanceListRefetchInterval({
  poll,
  pages,
}: {
  poll: boolean;
  pages?: ReadonlyArray<ReadonlyArray<ServerInstanceStatusDto>>;
}) {
  if (!poll) {
    return false;
  }

  const hasPendingInstance = pages?.some((page) => page.some(shouldPollServerInstance));

  return hasPendingInstance ? SERVER_INSTANCE_POLL_MS : false;
}

export function getServerInstanceDetailRefetchInterval(status: string | null | undefined) {
  if (status !== "ready" && status !== "bootstrap_failed") {
    return SERVER_INSTANCE_POLL_MS;
  }

  return SERVER_INSTANCE_IDLE_POLL_MS;
}

export function useServerInstanceDetail(instanceId: string | null | undefined) {
  return useRpcQuery(
    "server_get",
    { p_server_id: instanceId ?? "" },
    {
      enabled: !!instanceId,
      schema: serverInstanceDetailSchema,
      refetchInterval: (query: { state: { data?: ServerInstanceStatusDto | null } }) =>
        getServerInstanceDetailRefetchInterval(query.state.data?.status),
    },
  );
}

export function useServerInstanceListInfinite({
  pageSize = 20,
  kw = "",
  enabled = true,
  poll = true,
}: {
  pageSize?: number;
  kw?: string;
  enabled?: boolean;
  poll?: boolean;
} = {}) {
  const sb = useSupabaseBrowser();
  const queryKey = [...getRpcQueryKey("server_list_cursor"), { pageSize, kw }] as const;

  return useInfiniteQuery<
    ServerInstanceStatusDto[],
    Error,
    InfiniteData<ServerInstanceStatusDto[], { updated_at: string; id: string } | undefined>,
    typeof queryKey,
    { updated_at: string; id: string } | undefined
  >({
    queryKey,
    queryFn: async ({ pageParam }) => {
      const cursor = pageParam as { updated_at: string; id: string } | undefined;

      const { data, error } = await sb.rpc("server_list_cursor", {
        p_cursor_updated_at: cursor?.updated_at || undefined,
        p_cursor_id: cursor?.id || undefined,
        p_limit: pageSize,
        p_search: kw,
      });

      if (error) throw error;

      return serverInstanceListSchema.parse(data ?? []);
    },
    getNextPageParam: (lastPage) => {
      if (!lastPage || lastPage.length < pageSize) return undefined;
      const lastItem = lastPage[lastPage.length - 1];
      if (!lastItem.updated_at || !lastItem.id) return undefined;

      return {
        updated_at: lastItem.updated_at,
        id: lastItem.id,
      };
    },
    initialPageParam: undefined as { updated_at: string; id: string } | undefined,
    enabled,
    refetchInterval: (query) =>
      getServerInstanceListRefetchInterval({
        poll,
        pages: query.state.data?.pages,
      }),
  });
}
