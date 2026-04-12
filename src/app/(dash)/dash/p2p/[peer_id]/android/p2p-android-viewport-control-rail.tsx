"use client";

import { ArrowLeft, Camera, Circle, RotateCcw, Square } from "lucide-react";
import { cn } from "mtxuilib/lib/utils";
import { Button } from "mtxuilib/ui/button";
import type { AndroidScrcpyPerformanceProfile } from "@/lib/p2p/android-scrcpy-session";
import { AndroidMorePanel } from "./android-more-panel";
import type { P2PAndroidDirectExperimentView } from "./p2p-android-viewport-stage";
import type {
  AndroidDeviceOpHint,
  AndroidRemoteStatusView,
  AndroidSessionInfoItem,
} from "./p2p-android-viewport-support";

type AndroidControlRailProps = {
  directExperiment?: P2PAndroidDirectExperimentView;
  onPerformanceProfileChange: (profile: AndroidScrcpyPerformanceProfile) => void;
  onReconnect: () => void;
  reconnectEnabled: boolean;
  onRotate: () => void;
  onScreenshot: () => void;
  onSendText: (text: string) => Promise<boolean>;
  performanceMeta: string;
  performanceProfile: AndroidScrcpyPerformanceProfile;
  remoteStatus: AndroidRemoteStatusView;
  rotateEnabled: boolean;
  rotateHint: AndroidDeviceOpHint;
  screenshotEnabled: boolean;
  screenshotHint: AndroidDeviceOpHint;
  sessionDebugItems: AndroidSessionInfoItem[];
  sessionInfoItems: AndroidSessionInfoItem[];
  textActionsEnabled: boolean;
  textInputHint: AndroidDeviceOpHint;
};

type AndroidDeviceNavigationBarProps = {
  controlsEnabled: boolean;
  onBack: () => void;
  onHome: () => void;
  onRecents: () => void;
};

export function AndroidControlRail({
  directExperiment,
  onPerformanceProfileChange,
  onReconnect,
  reconnectEnabled,
  onRotate,
  onScreenshot,
  onSendText,
  performanceMeta,
  performanceProfile,
  remoteStatus,
  rotateEnabled,
  rotateHint,
  screenshotEnabled,
  screenshotHint,
  sessionDebugItems,
  sessionInfoItems,
  textActionsEnabled,
  textInputHint,
}: AndroidControlRailProps) {
  const shouldForceOpenMorePanel = remoteStatus.label === "Busy";

  return (
    <aside
      data-testid="android-control-rail"
      data-rail-variant="h2-lite"
      className="flex w-full shrink-0 flex-row items-center justify-end gap-1 bg-black px-1 py-1.5 text-white md:w-[56px] md:flex-col md:justify-start md:self-stretch md:px-1 md:py-2"
    >
      <div className="flex flex-1 flex-wrap items-center justify-end gap-1 md:w-full md:flex-none md:flex-col md:items-center md:justify-start">
        <AndroidMorePanel
          directExperiment={directExperiment}
          forceOpen={shouldForceOpenMorePanel}
          onPerformanceProfileChange={onPerformanceProfileChange}
          onReconnect={onReconnect}
          reconnectEnabled={reconnectEnabled}
          onSendText={onSendText}
          performanceMeta={performanceMeta}
          performanceProfile={performanceProfile}
          sessionDebugItems={sessionDebugItems}
          sessionInfoItems={sessionInfoItems}
          textActionsEnabled={textActionsEnabled}
          textInputHint={textInputHint}
        />
        <span data-testid="android-action-rotate">
          <Button
            data-testid="android-rotate-button"
            aria-label="旋转设备"
            title={rotateEnabled ? "旋转设备" : rotateHint.title}
            size="icon"
            variant="secondary"
            className="rounded-md border-0 bg-zinc-900 text-white shadow-none hover:bg-zinc-800"
            disabled={!rotateEnabled}
            onClick={onRotate}
          >
            <RotateCcw className="size-4" />
          </Button>
        </span>
        <span data-testid="android-action-screenshot">
          <Button
            data-testid="android-screenshot-button"
            aria-label="下载截图"
            title={screenshotEnabled ? "下载截图" : screenshotHint.title}
            size="icon"
            variant="secondary"
            className="rounded-md border-0 bg-zinc-900 text-white shadow-none hover:bg-zinc-800"
            disabled={!screenshotEnabled}
            onClick={onScreenshot}
          >
            <Camera className="size-4" />
          </Button>
        </span>
      </div>
    </aside>
  );
}

export function AndroidDeviceNavigationBar({
  controlsEnabled,
  onBack,
  onHome,
  onRecents,
}: AndroidDeviceNavigationBarProps) {
  const navButtonClassName =
    "size-10 rounded-none border-0 bg-transparent text-zinc-300 shadow-none hover:bg-white/[0.04] hover:text-white disabled:text-zinc-600 disabled:hover:bg-transparent";

  return (
    <div
      data-testid="android-device-navigation"
      className="flex w-full items-center justify-between gap-0 bg-black px-3 py-2"
    >
      <Button
        data-testid="android-back-button"
        aria-label="返回"
        title="返回"
        size="icon"
        variant="ghost"
        className={navButtonClassName}
        disabled={!controlsEnabled}
        onClick={onBack}
      >
        <ArrowLeft className="size-4" />
      </Button>
      <Button
        data-testid="android-home-button"
        aria-label="Home"
        title="Home"
        size="icon"
        variant="ghost"
        className={cn(navButtonClassName, "text-white")}
        disabled={!controlsEnabled}
        onClick={onHome}
      >
        <Circle className="size-4" strokeWidth={2.2} />
      </Button>
      <Button
        data-testid="android-action-recents"
        aria-label="最近任务"
        title="最近任务"
        size="icon"
        variant="ghost"
        className={navButtonClassName}
        disabled={!controlsEnabled}
        onClick={onRecents}
      >
        <Square className="size-3.5" strokeWidth={2.2} />
      </Button>
    </div>
  );
}
