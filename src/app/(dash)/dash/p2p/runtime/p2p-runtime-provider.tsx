"use client";

import { createContext, type ReactNode, useContext } from "react";
import type { P2PRuntimeState } from "./p2p-runtime-contract";
import { selectP2PRuntimeHost } from "./select-p2p-runtime";
import { useAndroidHostRuntime } from "./use-android-host-runtime";
import { useBrowserP2PRuntime } from "./use-browser-p2p-runtime";

const P2PRuntimeContext = createContext<P2PRuntimeState | null>(null);

function BrowserRuntimeProviderValue({ children }: { children: ReactNode }) {
  const runtime = useBrowserP2PRuntime();
  return <P2PRuntimeContext.Provider value={runtime}>{children}</P2PRuntimeContext.Provider>;
}

function AndroidHostRuntimeProviderValue({ children }: { children: ReactNode }) {
  const runtime = useAndroidHostRuntime();
  return <P2PRuntimeContext.Provider value={runtime}>{children}</P2PRuntimeContext.Provider>;
}

export function P2PRuntimeProvider({ children }: { children: ReactNode }) {
  const hostKind = typeof window === "undefined" ? "browser" : selectP2PRuntimeHost(window);

  if (hostKind === "android-host") {
    return <AndroidHostRuntimeProviderValue>{children}</AndroidHostRuntimeProviderValue>;
  }

  return <BrowserRuntimeProviderValue>{children}</BrowserRuntimeProviderValue>;
}

export function useP2PRuntime() {
  const value = useContext(P2PRuntimeContext);
  if (value == null) {
    throw new Error("useP2PRuntime must be used within P2PRuntimeProvider");
  }
  return value;
}
