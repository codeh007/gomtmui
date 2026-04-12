"use client";
import { QueryClientProvider } from "@tanstack/react-query";
import { ReactQueryDevtools } from "@tanstack/react-query-devtools/production";
import { ReactQueryStreamedHydration } from "@tanstack/react-query-next-experimental";
import type { PropsWithChildren } from "react";
import { getQueryClient } from "../lib/get-query-client";

interface ReactQueryProviderProps {
  debug?: boolean;
}

export default function GomtmProvider({ children, debug = false }: PropsWithChildren<ReactQueryProviderProps>) {
  const queryClient = getQueryClient();

  return (
    <QueryClientProvider client={queryClient}>
      <ReactQueryStreamedHydration>{children}</ReactQueryStreamedHydration>
      {debug && <ReactQueryDevtools />}
    </QueryClientProvider>
  );
}
