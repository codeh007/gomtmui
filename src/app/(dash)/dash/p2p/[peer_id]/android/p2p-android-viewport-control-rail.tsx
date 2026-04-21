"use client";

import { Camera, RotateCcw } from "lucide-react";
import { Button } from "mtxuilib/ui/button";
import { AndroidMorePanel } from "./android-more-panel";
import type {
  AndroidDeviceOpHint,
  AndroidPerformanceProfile,
  AndroidRemoteStatusView,
  AndroidSessionInfoItem,
} from "./p2p-android-viewport-support";

export type AndroidControlRailProps = {
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

type AndroidDeviceActionButtonProps = {
  ariaLabel: string;
  children: React.ReactNode;
  dataTestId: string;
  disabled: boolean;
  onClick: () => void;
  title: string;
};

function AndroidDeviceActionButton({
  ariaLabel,
  children,
  dataTestId,
  disabled,
  onClick,
  title,
}: AndroidDeviceActionButtonProps) {
  return (
    <Button
      data-testid={dataTestId}
      aria-label={ariaLabel}
      title={title}
      size="icon"
      variant="secondary"
      className="rounded-md border-0 bg-zinc-900 text-white shadow-none hover:bg-zinc-800"
      disabled={disabled}
      onClick={onClick}
    >
      {children}
    </Button>
  );
}

export function AndroidControlRail({
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
          forceOpen={shouldForceOpenMorePanel}
          onReconnect={onReconnect}
          reconnectEnabled={reconnectEnabled}
          onSendText={onSendText}
          performanceControls={performanceControls}
          sessionInfoItems={sessionInfoItems}
          showPerformanceControls={showPerformanceControls}
          textActionsEnabled={textActionsEnabled}
          textInputHint={textInputHint}
        />
        <span data-testid="android-action-rotate">
          <AndroidDeviceActionButton
            dataTestId="android-rotate-button"
            ariaLabel="旋转设备"
            title={rotateEnabled ? "旋转设备" : rotateHint.title}
            disabled={!rotateEnabled}
            onClick={onRotate}
          >
            <RotateCcw className="size-4" />
          </AndroidDeviceActionButton>
        </span>
        <span data-testid="android-action-screenshot">
          <AndroidDeviceActionButton
            dataTestId="android-screenshot-button"
            ariaLabel="下载截图"
            title={screenshotEnabled ? "下载截图" : screenshotHint.title}
            disabled={!screenshotEnabled}
            onClick={onScreenshot}
          >
            <Camera className="size-4" />
          </AndroidDeviceActionButton>
        </span>
      </div>
    </aside>
  );
}
