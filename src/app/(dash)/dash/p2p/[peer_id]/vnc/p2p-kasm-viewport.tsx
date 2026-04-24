import type { ReactNode } from "react";

export function P2PKasmViewport(props: { children?: ReactNode }) {
  return <div data-testid="p2p-kasm-viewport">{props.children}</div>;
}
