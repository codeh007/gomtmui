import type { ReactNode } from "react";
import { P2PRuntimeProvider } from "./runtime/p2p-runtime-provider";

export default function P2PLayout({ children }: { children: ReactNode }) {
  return <P2PRuntimeProvider>{children}</P2PRuntimeProvider>;
}
