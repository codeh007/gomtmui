import type { PostgrestError } from "@supabase/postgrest-js";
import type { UseMutationOptions, UseMutationResult } from "@tanstack/react-query";
import type { z } from "zod";
import type { UseQueryAnyReturn } from "mtmsdk/supabase/use-sb-query/use-query";
import type { RpcMutationResult } from "mtmsdk/supabase/use-sb-query/use-rpc-mutation";
import type {
  ExtractCreateResult,
  MProxyExtractRow,
  MProxyExtractUpdateRow,
  MProxyNodeRow,
  SubscriptionImportResult,
  SubscriptionPayload,
} from "@/components/mproxy/schemas";

type MProxySchemaQueryReturn<TSchema extends z.ZodTypeAny> = Omit<UseQueryAnyReturn<unknown>, "data" | "error"> & {
  data: z.infer<TSchema> | undefined;
  error: PostgrestError | Error | null;
};

declare module "mtmsdk/supabase/use-sb-query/use-rpc-query" {
  export function useRpcQuery<TSchema extends z.ZodTypeAny>(
    functionName: "mproxy_node_list",
    args: { p_kw?: string | null } | undefined,
    options: Record<string, unknown> & { schema: TSchema },
  ): MProxySchemaQueryReturn<TSchema>;

  export function useRpcQuery<TSchema extends z.ZodTypeAny>(
    functionName: "mproxy_extract_list",
    args: undefined,
    options: Record<string, unknown> & { schema: TSchema },
  ): MProxySchemaQueryReturn<TSchema>;

  export function useRpcQuery(
    functionName: "mproxy_node_list",
    args?: { p_kw?: string | null },
    options?: Record<string, unknown> & { schema?: undefined },
  ): UseQueryAnyReturn<MProxyNodeRow[]>;

  export function useRpcQuery(
    functionName: "mproxy_extract_list",
    args?: undefined,
    options?: Record<string, unknown> & { schema?: undefined },
  ): UseQueryAnyReturn<MProxyExtractRow[]>;
}

declare module "mtmsdk/supabase/use-sb-query/use-rpc-mutation" {
  export function useRpcMutation(
    functionName: "mproxy_subscription_import",
    options?: Omit<
      UseMutationOptions<
        RpcMutationResult<SubscriptionImportResult[]>,
        PostgrestError,
        { p_name: string; p_payload: SubscriptionPayload; p_source_url: string },
        unknown
      >,
      "mutationFn"
    >,
  ): UseMutationResult<
    RpcMutationResult<SubscriptionImportResult[]>,
    PostgrestError,
    { p_name: string; p_payload: SubscriptionPayload; p_source_url: string },
    unknown
  >;

  export function useRpcMutation(
    functionName: "mproxy_extract_create",
    options?: Omit<
      UseMutationOptions<
        RpcMutationResult<ExtractCreateResult[]>,
        PostgrestError,
        { p_display_name: string; p_expires_at: string; p_node_id: string },
        unknown
      >,
      "mutationFn"
    >,
  ): UseMutationResult<
    RpcMutationResult<ExtractCreateResult[]>,
    PostgrestError,
    { p_display_name: string; p_expires_at: string; p_node_id: string },
    unknown
  >;

  export function useRpcMutation(
    functionName: "mproxy_extract_update",
    options?: Omit<
      UseMutationOptions<
        RpcMutationResult<MProxyExtractUpdateRow>,
        PostgrestError,
        { p_disabled: boolean; p_expires_at: string; p_id: string },
        unknown
      >,
      "mutationFn"
    >,
  ): UseMutationResult<
    RpcMutationResult<MProxyExtractUpdateRow>,
    PostgrestError,
    { p_disabled: boolean; p_expires_at: string; p_id: string },
    unknown
  >;

  export function useRpcMutation(
    functionName: "mproxy_extract_delete",
    options?: Omit<
      UseMutationOptions<RpcMutationResult<boolean>, PostgrestError, { p_id: string }, unknown>,
      "mutationFn"
    >,
  ): UseMutationResult<RpcMutationResult<boolean>, PostgrestError, { p_id: string }, unknown>;
}
