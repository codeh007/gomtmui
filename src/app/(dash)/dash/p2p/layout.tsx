import type { ReactNode } from "react";
import { P2PShellProvider } from "./runtime/p2p-runtime-provider";

export default function P2PLayout({ children }: { children: ReactNode }) {
  return <P2PShellProvider>{children}</P2PShellProvider>;
}
