export type DeviceBadgeVariant = "default" | "secondary" | "destructive" | "outline";

export interface DeviceStateItemsInput {
  activationStatus: string | null | undefined;
  presenceStatus: string | null | undefined;
  runtimeStatus: string | null | undefined;
}

export interface DeviceStateItem {
  label: string;
  value: string;
  variant: DeviceBadgeVariant;
}

export interface AndroidHostStartStateInput {
  activationSurfaceCanStart: boolean;
  boundDeviceId: string | null;
}

export interface AndroidHostStopStateInput {
  activationSurfaceCanStop: boolean;
  boundDeviceId: string | null;
}

function activationVariant(value: string): DeviceBadgeVariant {
  switch (value) {
    case "active":
      return "default";
    case "activating":
      return "secondary";
    case "disabled":
      return "destructive";
    default:
      return "outline";
  }
}

function presenceVariant(value: string): DeviceBadgeVariant {
  switch (value) {
    case "online":
      return "default";
    case "stale":
      return "secondary";
    case "offline":
      return "destructive";
    default:
      return "outline";
  }
}

function runtimeVariant(value: string): DeviceBadgeVariant {
  switch (value) {
    case "ready":
      return "default";
    case "booting":
    case "busy":
    case "degraded":
      return "secondary";
    case "error":
      return "destructive";
    default:
      return "outline";
  }
}

function normalizeStatus(value: string | null | undefined, fallback: string) {
  const trimmed = value?.trim();
  return trimmed ? trimmed : fallback;
}

export function buildDeviceStateItems(input: DeviceStateItemsInput): DeviceStateItem[] {
  const activationStatus = normalizeStatus(input.activationStatus, "inactive");
  const presenceStatus = normalizeStatus(input.presenceStatus, "offline");
  const runtimeStatus = normalizeStatus(input.runtimeStatus, "stopped");

  return [
    { label: "激活", value: activationStatus, variant: activationVariant(activationStatus) },
    { label: "在线", value: presenceStatus, variant: presenceVariant(presenceStatus) },
    { label: "运行时", value: runtimeStatus, variant: runtimeVariant(runtimeStatus) },
  ];
}

export function canStartAndroidHostDeviceService(input: AndroidHostStartStateInput) {
  return Boolean(input.boundDeviceId) && input.activationSurfaceCanStart;
}

export function canStopAndroidHostDeviceService(input: AndroidHostStopStateInput) {
  return Boolean(input.boundDeviceId) && input.activationSurfaceCanStop;
}
