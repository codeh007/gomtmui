import { afterEach, describe, expect, it, vi } from "vitest";
import {
  buildDeviceStateItems,
  buildDeviceStateRecord,
  canStartAndroidHostDeviceService,
  canStopAndroidHostDeviceService,
  formatManagedRuntimePlatform,
  resolveAndroidHostRuntimeDevice,
  waitForPolledValue,
} from "./device-state";

afterEach(() => {
  vi.useRealTimers();
});

describe("buildDeviceStateItems", () => {
  it("returns canonical activation, presence, and runtime items", () => {
    expect(
      buildDeviceStateItems({
        activationStatus: "activating",
        presenceStatus: "online",
        runtimeStatus: "ready",
      }),
    ).toEqual([
      { label: "激活", value: "activating", variant: "secondary" },
      { label: "在线", value: "online", variant: "default" },
      { label: "运行时", value: "ready", variant: "default" },
    ]);
  });

  it("keeps linux runtime rows on the canonical activation, presence, and runtime surface", () => {
    expect(
      buildDeviceStateRecord({
        activationStatus: "active",
        presenceStatus: "online",
        runtimeStatus: "ready",
      }),
    ).toEqual({
      activation: { label: "激活", value: "active", variant: "default" },
      presence: { label: "在线", value: "online", variant: "default" },
      runtime: { label: "运行时", value: "ready", variant: "default" },
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
            activationStatus: "inactive",
            presenceStatus: "offline",
            runtimeStatus: "stopped",
            lastSeenAt: null,
            lastError: null,
            hostKind: "android-host",
            packageName: "com.gomtm.one",
          },
          {
            id: "device-2",
            activationStatus: "inactive",
            presenceStatus: "offline",
            runtimeStatus: "stopped",
            lastSeenAt: null,
            lastError: null,
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
            activationStatus: "inactive",
            presenceStatus: "offline",
            runtimeStatus: "stopped",
            lastSeenAt: null,
            lastError: null,
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
