"use client";

import { createContext, type ReactNode, useContext } from "react";
import type { P2PShellState } from "./p2p-runtime-contract";
import { selectP2PShellKind } from "./select-p2p-runtime";
import { useDeviceShellRuntime } from "./use-android-host-runtime";
import { useServerShellRuntime } from "./use-server-shell-runtime";

const P2PShellContext = createContext<P2PShellState | null>(null);

function ServerShellRuntimeProviderValue({ children }: { children: ReactNode }) {
  const runtime = useServerShellRuntime();
  return <P2PShellContext.Provider value={runtime}>{children}</P2PShellContext.Provider>;
}

function DeviceShellRuntimeProviderValue({ children }: { children: ReactNode }) {
  const runtime = useDeviceShellRuntime();
  return <P2PShellContext.Provider value={runtime}>{children}</P2PShellContext.Provider>;
}

export function P2PShellProvider({ children }: { children: ReactNode }) {
  const shellKind = typeof window === "undefined" ? "server-shell" : selectP2PShellKind(window);

  if (shellKind === "device-shell") {
    return <DeviceShellRuntimeProviderValue>{children}</DeviceShellRuntimeProviderValue>;
  }

  return <ServerShellRuntimeProviderValue>{children}</ServerShellRuntimeProviderValue>;
}

export function useP2PShellState() {
  const value = useContext(P2PShellContext);
  if (value == null) {
    throw new Error("useP2PShellState must be used within P2PShellProvider");
  }
  return value;
}
