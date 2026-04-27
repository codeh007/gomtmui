import { describe, expect, it } from "vitest";
import { buildDeviceStateItems, canStartAndroidHostDeviceService, canStopAndroidHostDeviceService } from "./device-state";

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
