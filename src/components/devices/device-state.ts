export type DeviceBadgeVariant = "default" | "secondary" | "destructive" | "outline";

export interface PresenceBadge {
	label: string;
	value: "online" | "offline";
	variant: DeviceBadgeVariant;
}

export const DEVICE_ONLINE_TIMEOUT_MS = 2 * 60 * 1000;

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
	lastSeenAt: string | null;
	lastError: string | null;
	archivedAt: string | null;
	hostKind: string | null;
	packageName: string | null;
}

export interface AndroidHostIdentityInput {
  hostKind: string;
  packageName?: string;
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

export function isDeviceOnline(lastSeenAt: string | null | undefined, now = Date.now(), timeoutMs = DEVICE_ONLINE_TIMEOUT_MS) {
	if (!lastSeenAt) {
		return false;
	}

	const seenAt = new Date(lastSeenAt).getTime();
	if (Number.isNaN(seenAt)) {
		return false;
	}

	return now - seenAt <= timeoutMs;
}

export function buildPresenceBadge(lastSeenAt: string | null | undefined, now = Date.now(), timeoutMs = DEVICE_ONLINE_TIMEOUT_MS): PresenceBadge {
	if (isDeviceOnline(lastSeenAt, now, timeoutMs)) {
		return {
			label: "在线",
			value: "online",
			variant: "default",
		};
	}

	return {
		label: "离线",
		value: "offline",
		variant: "destructive",
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
