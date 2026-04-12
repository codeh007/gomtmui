import type { useP2PAndroidPageSession } from "./use-p2p-android-page-session";

export type NativeViewportSessionLike = ReturnType<typeof useP2PAndroidPageSession>;

export type StreamStatus = "idle" | "connecting" | "connected" | "error";
