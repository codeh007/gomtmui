export type AndroidNativeRemoteV2AvailabilityMeta = {
  label: string;
  tone: "muted" | "success" | "warning";
  detail: string;
};

export function getAndroidNativeRemoteV2AvailabilityMeta(
  state: string | null | undefined,
  reason?: string | null,
): AndroidNativeRemoteV2AvailabilityMeta {
  const normalizedState = state?.trim().toLowerCase() ?? "";

  switch (normalizedState) {
    case "available":
    case "streaming":
      return {
        detail: reason?.trim() || "native remote v2 ready",
        label: "可用",
        tone: "success",
      };
    case "permission_required":
      return {
        detail: reason?.trim() || "screen capture permission required",
        label: "待授权",
        tone: "warning",
      };
    case "connecting":
    case "starting":
      return {
        detail: reason?.trim() || "native remote v2 starting",
        label: "启动中",
        tone: "muted",
      };
    default:
      return {
        detail: reason?.trim() || "native remote v2 unavailable",
        label: "不可用",
        tone: "warning",
      };
  }
}
