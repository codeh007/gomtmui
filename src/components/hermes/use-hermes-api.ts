"use client";

import { useMemo } from "react";

import { useGomtmServer } from "@/lib/gomtm-server/provider";
import { createHermesApi } from "@/lib/hermes/api";

export function useHermesApi() {
  const { serverUrl } = useGomtmServer();

  return useMemo(() => createHermesApi(serverUrl), [serverUrl]);
}
