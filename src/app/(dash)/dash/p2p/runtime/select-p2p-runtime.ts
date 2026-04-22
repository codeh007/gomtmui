import type { P2PHostKind } from "./p2p-runtime-contract";

type MaybePromise<T> = T | Promise<T>;

export type GomtmHostBridge = {
  getConnectionConfig?: () => MaybePromise<unknown>;
  getHostInfo?: () => MaybePromise<unknown>;
  getPeerCapabilities?: (peerId: string) => MaybePromise<unknown>;
  getRuntimeSnapshot?: () => MaybePromise<unknown>;
  listDiscoveredPeers?: () => MaybePromise<unknown>;
  saveConnectionConfig?: (payloadJson: string) => MaybePromise<unknown>;
};

export type WindowWithGomtmHostBridge = Window & {
  GomtmHostBridge?: GomtmHostBridge;
};

export function getGomtmHostBridge(win: Window): GomtmHostBridge | null {
  return (win as WindowWithGomtmHostBridge).GomtmHostBridge ?? null;
}

export function selectP2PRuntimeHost(win: Window): P2PHostKind {
  return getGomtmHostBridge(win) == null ? "browser" : "android-host";
}
