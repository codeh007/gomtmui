import type { ReactNode } from "react";
import { P2PSessionProvider } from "./use-p2p-session";

export default function P2PLayout({ children }: { children: ReactNode }) {
  return <P2PSessionProvider>{children}</P2PSessionProvider>;
}
