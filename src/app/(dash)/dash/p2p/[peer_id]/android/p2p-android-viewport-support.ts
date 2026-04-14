export type AndroidPerformanceProfile = "low" | "medium" | "high";

export type ViewportSize = {
  height: number;
  width: number;
};

export type AndroidRemoteStatusLabel = "Busy" | "Connected" | "Connecting" | "Error" | "Reconnecting" | "Unsupported";

export type AndroidRemoteStatusView = {
  detail: string;
  label: AndroidRemoteStatusLabel;
  showBusyIndicator: boolean;
};

export type AndroidDeviceOpNotice = {
  detail: string;
  tone: "danger" | "muted" | "success" | "warning";
  title: string;
};

export type AndroidDeviceOpName = "captureScreenshot" | "rotate" | "writeClipboard";

export type AndroidDeviceOpHint = AndroidDeviceOpNotice & {
  op: AndroidDeviceOpName;
};

export type AndroidSessionInfoItem = {
  label: string;
  value: string;
};

export const ANDROID_PERFORMANCE_PROFILES = ["low", "medium", "high"] as const satisfies readonly AndroidPerformanceProfile[];

export function resolveAndroidPerformanceTuning(profile: AndroidPerformanceProfile) {
  switch (profile) {
    case "low":
      return { label: "低档" };
    case "high":
      return { label: "高档" };
    case "medium":
    default:
      return { label: "中档" };
  }
}
