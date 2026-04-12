import { LoaderCircle } from "lucide-react";
import { cn } from "mtxuilib/lib/utils";
import type { ReactNode } from "react";
import type { AndroidScrcpyPerformanceProfile } from "@/lib/p2p/android-scrcpy-session";
import { AndroidControlRail, AndroidDeviceNavigationBar } from "./p2p-android-viewport-control-rail";
import type {
  AndroidDeviceOpHint,
  AndroidDeviceOpNotice,
  AndroidRemoteStatusView,
  AndroidSessionInfoItem,
  ViewportSize,
} from "./p2p-android-viewport-support";
import type { AndroidDirectLaneState } from "./use-android-direct-lane";

export type P2PAndroidDirectExperimentView = {
  candidatePairSummary: string;
  canRun: boolean;
  directEvidenceSummary: string;
  lastError: string | null;
  lastResult: unknown;
  onRun: () => Promise<unknown> | undefined;
  state: AndroidDirectLaneState;
};

type P2PAndroidViewportStageProps = {
  controlsEnabled: boolean;
  deviceOpNotice: AndroidDeviceOpNotice | null;
  directExperiment?: P2PAndroidDirectExperimentView;
  onBack: () => void;
  onHome: () => void;
  onPerformanceProfileChange: (profile: AndroidScrcpyPerformanceProfile) => void;
  onReconnect: () => void;
  onRecents: () => void;
  onRotate: () => void;
  onScreenshot: () => void;
  onSendText: (text: string) => Promise<boolean>;
  performanceMeta: string;
  performanceProfile: AndroidScrcpyPerformanceProfile;
  reconnectEnabled: boolean;
  remoteCanvas: ReactNode;
  remoteStatus: AndroidRemoteStatusView;
  rotateEnabled: boolean;
  rotateHint: AndroidDeviceOpHint;
  screenshotEnabled: boolean;
  screenshotHint: AndroidDeviceOpHint;
  sessionDebugItems: AndroidSessionInfoItem[];
  sessionInfoItems: AndroidSessionInfoItem[];
  textActionsEnabled: boolean;
  textInputHint: AndroidDeviceOpHint;
  viewportSize: ViewportSize;
};

function RemoteStageStatusCard({ remoteStatus }: { remoteStatus: AndroidRemoteStatusView }) {
  if (remoteStatus.label === "Connected") {
    return null;
  }

  return (
    <div
      className={cn(
        "inline-flex max-w-sm items-center gap-2 rounded-full border border-white/10 bg-black/75 px-4 py-2 text-sm text-white shadow-2xl backdrop-blur-md",
        remoteStatus.label === "Error" && "border-rose-500/40 text-rose-100",
        remoteStatus.label === "Busy" && "border-amber-400/40 text-amber-100",
        remoteStatus.label === "Unsupported" && "border-zinc-400/40 text-zinc-100",
        (remoteStatus.label === "Connecting" || remoteStatus.label === "Reconnecting") &&
          "border-sky-400/40 text-sky-100",
      )}
      data-testid={remoteStatus.showBusyIndicator ? "android-controller-busy" : undefined}
    >
      {remoteStatus.label === "Connecting" || remoteStatus.label === "Reconnecting" ? (
        <LoaderCircle className="size-4 shrink-0 animate-spin text-current" />
      ) : null}

      <div className="min-w-0 text-center leading-5">{remoteStatus.detail}</div>
    </div>
  );
}

function RemoteStageDeviceOpNotice({ deviceOpNotice }: { deviceOpNotice: AndroidDeviceOpNotice | null }) {
  if (deviceOpNotice == null) {
    return null;
  }

  return (
    <div className="pointer-events-none absolute inset-x-0 bottom-4 z-10 flex justify-center px-4">
      <div
        data-testid="android-device-op-notice"
        className={cn(
          "max-w-sm rounded-2xl border px-3 py-2 text-left text-xs leading-5 shadow-2xl backdrop-blur-md",
          deviceOpNotice.tone === "danger" && "border-rose-500/30 bg-rose-500/10 text-rose-100",
          deviceOpNotice.tone === "warning" && "border-amber-400/30 bg-amber-400/10 text-amber-100",
          deviceOpNotice.tone === "success" && "border-emerald-400/30 bg-emerald-400/10 text-emerald-100",
          deviceOpNotice.tone === "muted" && "border-sky-400/20 bg-sky-400/10 text-sky-100",
        )}
      >
        <div className="font-medium">{deviceOpNotice.title}</div>
        <div className="mt-1 text-[11px] text-inherit/90">{deviceOpNotice.detail}</div>
      </div>
    </div>
  );
}

export function P2PAndroidViewportStage({
  controlsEnabled,
  deviceOpNotice,
  directExperiment,
  onBack,
  onHome,
  onPerformanceProfileChange,
  onReconnect,
  onRecents,
  onRotate,
  onScreenshot,
  onSendText,
  performanceMeta,
  performanceProfile,
  reconnectEnabled,
  remoteCanvas,
  remoteStatus,
  rotateEnabled,
  rotateHint,
  screenshotEnabled,
  screenshotHint,
  sessionDebugItems,
  sessionInfoItems,
  textActionsEnabled,
  textInputHint,
  viewportSize,
}: P2PAndroidViewportStageProps) {
  return (
    <div className="flex h-full min-h-0 items-center justify-center bg-black">
      <div className="flex h-full w-full min-h-0 items-center justify-center overflow-auto p-0">
        <div className="flex w-full min-w-0 flex-col items-center justify-center gap-0 md:flex-row md:items-stretch md:justify-center md:gap-0">
          <section
            data-testid="android-remote-stage"
            className="flex min-h-0 min-w-0 flex-1 justify-center md:justify-end"
          >
            <div className="flex w-full max-w-[420px] flex-col bg-black">
              <div
                data-testid="android-remote-frame"
                className="relative w-full overflow-hidden bg-black"
                style={{ aspectRatio: `${viewportSize.width}/${viewportSize.height}` }}
              >
                <div className="relative flex h-full w-full items-center justify-center overflow-hidden bg-black">
                  {remoteCanvas}
                  <div className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center p-4">
                    <RemoteStageStatusCard remoteStatus={remoteStatus} />
                  </div>
                  <RemoteStageDeviceOpNotice deviceOpNotice={deviceOpNotice} />
                </div>
              </div>
              <AndroidDeviceNavigationBar
                controlsEnabled={controlsEnabled}
                onBack={onBack}
                onHome={onHome}
                onRecents={onRecents}
              />
            </div>
          </section>
          <AndroidControlRail
            directExperiment={directExperiment}
            onPerformanceProfileChange={onPerformanceProfileChange}
            onReconnect={onReconnect}
            reconnectEnabled={reconnectEnabled}
            onRotate={onRotate}
            onScreenshot={onScreenshot}
            onSendText={onSendText}
            performanceMeta={performanceMeta}
            performanceProfile={performanceProfile}
            remoteStatus={remoteStatus}
            rotateEnabled={rotateEnabled}
            rotateHint={rotateHint}
            screenshotEnabled={screenshotEnabled}
            screenshotHint={screenshotHint}
            sessionDebugItems={sessionDebugItems}
            sessionInfoItems={sessionInfoItems}
            textActionsEnabled={textActionsEnabled}
            textInputHint={textInputHint}
          />
        </div>
      </div>
    </div>
  );
}
