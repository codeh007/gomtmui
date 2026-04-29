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

export interface DeviceStateRecord {
  activation: DeviceStateItem;
  presence: DeviceStateItem;
  runtime: DeviceStateItem;
}

export interface AndroidHostStartStateInput {
  activationSurfaceCanStart: boolean;
  boundDeviceId: string | null;
}

export interface AndroidHostStopStateInput {
  activationSurfaceCanStop: boolean;
  boundDeviceId: string | null;
}

export interface AndroidHostRuntimeDevice {
  id: string;
  activationStatus: string;
  presenceStatus: string;
  runtimeStatus: string;
  lastSeenAt: string | null;
  lastError: string | null;
  hostKind: string | null;
  packageName: string | null;
}

export interface AndroidHostIdentityInput {
  hostKind: string;
  packageName?: string;
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

function normalizeIdentityValue(value: string | null | undefined) {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

function wait(ms: number) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
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

export function buildDeviceStateRecord(input: DeviceStateItemsInput): DeviceStateRecord {
  const [activation, presence, runtime] = buildDeviceStateItems(input);
  return {
    activation,
    presence,
    runtime,
  };
}

export function formatManagedRuntimePlatform(platform: string | null | undefined) {
  const value = normalizeStatus(platform, "unknown").toLowerCase();
  switch (value) {
    case "android":
      return "Android";
    case "linux":
      return "Linux";
    default:
      return value;
  }
}

export function canStartAndroidHostDeviceService(input: AndroidHostStartStateInput) {
  return Boolean(input.boundDeviceId) && input.activationSurfaceCanStart;
}

export function canStopAndroidHostDeviceService(input: AndroidHostStopStateInput) {
  return Boolean(input.boundDeviceId) && input.activationSurfaceCanStop;
}

export function resolveAndroidHostRuntimeDevice(devices: AndroidHostRuntimeDevice[], host: AndroidHostIdentityInput) {
  const hostKind = normalizeIdentityValue(host.hostKind);
  const packageName = normalizeIdentityValue(host.packageName);
  if (!hostKind || !packageName) {
    return null;
  }

  return (
    devices.find((device) => {
      return normalizeIdentityValue(device.hostKind) === hostKind && normalizeIdentityValue(device.packageName) === packageName;
    }) ?? null
  );
}

export async function waitForPolledValue<T>(
  readValue: () => T,
  predicate: (value: T) => boolean,
  syncValue: (value: T) => void,
  timeoutMs = 5000,
  intervalMs = 250,
) {
  const startedAt = Date.now();
  while (Date.now() - startedAt <= timeoutMs) {
    const value = readValue();
    syncValue(value);
    if (predicate(value)) {
      return true;
    }
    await wait(intervalMs);
  }
  return false;
}
