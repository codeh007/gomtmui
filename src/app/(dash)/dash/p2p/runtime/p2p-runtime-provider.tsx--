"use client";

import { createContext, type ReactNode, useContext } from "react";
import type { P2PShellState } from "./p2p-runtime-contract";
import { useServerShellRuntime } from "./use-server-shell-runtime";

const P2PShellContext = createContext<P2PShellState | null>(null);

function ServerShellRuntimeProviderValue({ children }: { children: ReactNode }) {
  const runtime = useServerShellRuntime();
  return <P2PShellContext.Provider value={runtime}>{children}</P2PShellContext.Provider>;
}

export function P2PShellProvider({ children }: { children: ReactNode }) {
  return <ServerShellRuntimeProviderValue>{children}</ServerShellRuntimeProviderValue>;
}

export function useP2PShellState() {
  const value = useContext(P2PShellContext);
  if (value == null) {
    throw new Error("useP2PShellState must be used within P2PShellProvider");
  }
  return value;
}
