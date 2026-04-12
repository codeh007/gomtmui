"use client";

import { useQuery, useSuspenseQuery } from "@tanstack/react-query";
import { useSupabaseBrowser } from "mtmsdk/supabase/context";

export const useUser = () => {
  const sb = useSupabaseBrowser();

  const sessionQuery = useSuspenseQuery({
    queryKey: ["sb:auth:user"],
    queryFn: async () => {
      const { data, error } = await sb.auth.getUser();
      if (error) {
        throw error;
      }
      return data;
    },
  });
  return sessionQuery.data.user;
};

export const useSbSession = () => {
  const sb = useSupabaseBrowser();
  const sessionQuery = useQuery({
    queryKey: ["sb:auth:sessions"],
    queryFn: async () => {
      const { data, error } = await sb.auth.getSession();
      if (error) {
        throw error;
      }
      return data;
    },
  });
  return sessionQuery.data?.session;
};
