import { afterEach, describe, expect, it, vi } from "vitest";
import {
	buildPresenceBadge,
	canStartAndroidHostDeviceService,
	canStopAndroidHostDeviceService,
	DEVICE_ONLINE_TIMEOUT_MS,
	formatManagedRuntimePlatform,
	isDeviceOnline,
	resolveAndroidHostRuntimeDevice,
	waitForPolledValue,
} from "./device-state";

afterEach(() => {
  vi.useRealTimers();
});

describe("isDeviceOnline", () => {
	it("returns true when last_seen_at is inside the timeout window", () => {
		const now = Date.parse("2026-04-29T10:01:00Z");
		expect(isDeviceOnline("2026-04-29T10:00:30Z", now, DEVICE_ONLINE_TIMEOUT_MS)).toBe(true);
	});

	it("returns false when last_seen_at is missing or expired", () => {
		const now = Date.parse("2026-04-29T10:05:00Z");
		expect(isDeviceOnline(null, now, DEVICE_ONLINE_TIMEOUT_MS)).toBe(false);
		expect(isDeviceOnline("2026-04-29T10:00:00Z", now, DEVICE_ONLINE_TIMEOUT_MS)).toBe(false);
	});
});

describe("buildPresenceBadge", () => {
	it("returns 在线 for a fresh heartbeat", () => {
		const now = Date.parse("2026-04-29T10:01:00Z");
		expect(buildPresenceBadge("2026-04-29T10:00:30Z", now, DEVICE_ONLINE_TIMEOUT_MS)).toEqual({
			label: "在线",
			value: "online",
			variant: "default",
		});
	});

	it("returns 离线 when heartbeat is missing or expired", () => {
		const now = Date.parse("2026-04-29T10:05:00Z");
		expect(buildPresenceBadge(null, now, DEVICE_ONLINE_TIMEOUT_MS)).toEqual({
			label: "离线",
			value: "offline",
			variant: "destructive",
		});
	});
});

describe("formatManagedRuntimePlatform", () => {
  it("formats linux and android as the shared managed runtime platforms", () => {
    expect(formatManagedRuntimePlatform("linux")).toBe("Linux");
    expect(formatManagedRuntimePlatform(" android ")).toBe("Android");
  });

  it("falls back to normalized lowercase text for unknown platforms", () => {
    expect(formatManagedRuntimePlatform("Darwin")).toBe("darwin");
  });
});

describe("canStartAndroidHostDeviceService", () => {
  it("returns false when no bound device exists", () => {
    expect(
      canStartAndroidHostDeviceService({
        activationSurfaceCanStart: true,
        boundDeviceId: null,
      }),
    ).toBe(false);
  });

  it("returns false when host surface blocks start", () => {
    expect(
      canStartAndroidHostDeviceService({
        activationSurfaceCanStart: false,
        boundDeviceId: "device-1",
      }),
    ).toBe(false);
  });

  it("returns true when host allows start and device is bound", () => {
    expect(
      canStartAndroidHostDeviceService({
        activationSurfaceCanStart: true,
        boundDeviceId: "device-1",
      }),
    ).toBe(true);
  });
});

describe("canStopAndroidHostDeviceService", () => {
  it("returns false when no bound device exists", () => {
    expect(
      canStopAndroidHostDeviceService({
        activationSurfaceCanStop: true,
        boundDeviceId: null,
      }),
    ).toBe(false);
  });

  it("returns false when host surface blocks stop", () => {
    expect(
      canStopAndroidHostDeviceService({
        activationSurfaceCanStop: false,
        boundDeviceId: "device-1",
      }),
    ).toBe(false);
  });

  it("returns true when host allows stop and device is bound", () => {
    expect(
      canStopAndroidHostDeviceService({
        activationSurfaceCanStop: true,
        boundDeviceId: "device-1",
      }),
    ).toBe(true);
  });
});

describe("resolveAndroidHostRuntimeDevice", () => {
  it("matches the exact hostKind/packageName pair", () => {
    expect(
		resolveAndroidHostRuntimeDevice(
			[
				{
					id: "device-1",
					lastSeenAt: null,
					lastError: null,
					archivedAt: null,
					hostKind: "android-host",
					packageName: "com.gomtm.one",
				},
				{
					id: "device-2",
					lastSeenAt: null,
					lastError: null,
					archivedAt: null,
					hostKind: "android-host",
					packageName: "com.gomtm.two",
				},
        ],
        {
          hostKind: "android-host",
          packageName: "com.gomtm.two",
        },
      )?.id,
    ).toBe("device-2");
  });

  it("returns null when packageName does not match", () => {
    expect(
		resolveAndroidHostRuntimeDevice(
			[
				{
					id: "device-1",
					lastSeenAt: null,
					lastError: null,
					archivedAt: null,
					hostKind: "android-host",
					packageName: "com.gomtm.one",
				},
        ],
        {
          hostKind: "android-host",
          packageName: "com.gomtm.other",
        },
      ),
    ).toBeNull();
  });
});

describe("waitForPolledValue", () => {
  it("returns false when the predicate never becomes true", async () => {
    vi.useFakeTimers();
    const syncValue = vi.fn();
    const promise = waitForPolledValue(
      () => false,
      (value) => value,
      syncValue,
      500,
      100,
    );

    await vi.advanceTimersByTimeAsync(600);

    await expect(promise).resolves.toBe(false);
    expect(syncValue).toHaveBeenCalled();
  });

  it("returns true once a later poll satisfies the predicate", async () => {
    vi.useFakeTimers();
    const syncValue = vi.fn();
    let callCount = 0;
    const promise = waitForPolledValue(
      () => {
        callCount += 1;
        return callCount >= 3;
      },
      (value) => value,
      syncValue,
      1000,
      100,
    );

    await vi.advanceTimersByTimeAsync(250);

    await expect(promise).resolves.toBe(true);
    expect(syncValue).toHaveBeenCalledTimes(3);
  });
});
