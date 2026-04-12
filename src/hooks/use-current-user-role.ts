"use client";

import { useRpcQuery } from "mtmsdk/supabase/use-sb-query/use-rpc-query";
import { z } from "zod";

export function useCurrentUserRole() {
  const adminQuery = useRpcQuery(
    "has_permission",
    {
      p_resource: "user_roles",
      p_action: "manage",
    },
    {
      schema: z.boolean(),
    },
  );

  return {
    isAdmin: adminQuery.data ?? false,
    isLoading: adminQuery.isLoading,
  };
}
