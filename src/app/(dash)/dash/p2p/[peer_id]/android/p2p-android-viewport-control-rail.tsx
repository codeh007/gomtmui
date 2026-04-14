"use client";

import { Camera, RotateCcw } from "lucide-react";
import { Button } from "mtxuilib/ui/button";
import type { P2PAndroidDirectExperimentView } from "./direct-experiment-view-model";
import { AndroidMorePanel } from "./android-more-panel";
import type {
  AndroidDeviceOpHint,
  AndroidPerformanceProfile,
  AndroidRemoteStatusView,
  AndroidSessionInfoItem,
} from "./p2p-android-viewport-support";

export type AndroidControlRailProps = {
  directExperiment?: P2PAndroidDirectExperimentView;
  onReconnect: () => void;
  reconnectEnabled: boolean;
  onRotate: () => void;
  onScreenshot: () => void;
  onSendText: (text: string) => Promise<boolean>;
  performanceControls?: {
    onPerformanceProfileChange: (profile: AndroidPerformanceProfile) => void;
    performanceMeta: string;
    performanceProfile: AndroidPerformanceProfile;
  };
  remoteStatus: AndroidRemoteStatusView;
  rotateEnabled: boolean;
  rotateHint: AndroidDeviceOpHint;
  screenshotEnabled: boolean;
  screenshotHint: AndroidDeviceOpHint;
  sessionDebugItems: AndroidSessionInfoItem[];
  sessionInfoItems: AndroidSessionInfoItem[];
  showPerformanceControls?: boolean;
  textActionsEnabled: boolean;
  textInputHint: AndroidDeviceOpHint;
};

export type AndroidDeviceNavigationBarProps = {
  controlsEnabled: boolean;
  onBack: () => void;
  onHome: () => void;
  onRecents: () => void;
};

export function AndroidControlRail({
  directExperiment,
  onReconnect,
  reconnectEnabled,
  onRotate,
  onScreenshot,
  onSendText,
  performanceControls,
  remoteStatus,
  rotateEnabled,
  rotateHint,
  screenshotEnabled,
  screenshotHint,
  sessionDebugItems,
  sessionInfoItems,
  showPerformanceControls = true,
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
          onReconnect={onReconnect}
          reconnectEnabled={reconnectEnabled}
          onSendText={onSendText}
          performanceControls={performanceControls}
          sessionDebugItems={sessionDebugItems}
          sessionInfoItems={sessionInfoItems}
          showPerformanceControls={showPerformanceControls}
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

