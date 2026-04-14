"use client";

import { Ellipsis, Info, Keyboard, RefreshCw } from "lucide-react";
import { OnlyDebug } from "mtxuilib/mt/DebugValue";
import { Button } from "mtxuilib/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "mtxuilib/ui/popover";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "mtxuilib/ui/sheet";
import { useEffect, useState } from "react";
import { AndroidDirectExperimentPanel } from "./android-direct-experiment-panel";
import { AndroidSessionInfoDialog } from "./android-session-info-dialog";
import { AndroidTextComposerAction } from "./android-text-composer-action";
import type { P2PAndroidDirectExperimentView } from "./direct-experiment-view-model";
import {
  ANDROID_PERFORMANCE_PROFILES,
  type AndroidDeviceOpHint,
  type AndroidPerformanceProfile,
  type AndroidSessionInfoItem,
  resolveAndroidPerformanceTuning,
} from "./p2p-android-viewport-support";

function useIsNarrowScreen() {
  const [isNarrowScreen, setIsNarrowScreen] = useState(() => {
    if (typeof window === "undefined") {
      return false;
    }

    return window.matchMedia("(max-width: 767px)").matches;
  });

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    const mediaQuery = window.matchMedia("(max-width: 767px)");
    const handleChange = (event: MediaQueryListEvent) => {
      setIsNarrowScreen(event.matches);
    };

    setIsNarrowScreen(mediaQuery.matches);
    mediaQuery.addEventListener("change", handleChange);

    return () => {
      mediaQuery.removeEventListener("change", handleChange);
    };
  }, []);

  return isNarrowScreen;
}

type AndroidMorePanelProps = {
  directExperiment?: P2PAndroidDirectExperimentView;
  forceOpen: boolean;
  onReconnect: () => void;
  reconnectEnabled: boolean;
  onSendText: (text: string) => Promise<boolean>;
  performanceControls?: {
    onPerformanceProfileChange: (profile: AndroidPerformanceProfile) => void;
    performanceMeta: string;
    performanceProfile: AndroidPerformanceProfile;
  };
  sessionDebugItems: AndroidSessionInfoItem[];
  sessionInfoItems: AndroidSessionInfoItem[];
  showPerformanceControls?: boolean;
  textActionsEnabled: boolean;
  textInputHint: AndroidDeviceOpHint;
};

export function AndroidMorePanel({
  directExperiment,
  forceOpen,
  onReconnect,
  reconnectEnabled,
  onSendText,
  performanceControls,
  sessionDebugItems,
  sessionInfoItems,
  showPerformanceControls = true,
  textActionsEnabled,
  textInputHint,
}: AndroidMorePanelProps) {
  const [activeSurface, setActiveSurface] = useState<"sessionInfo" | "textComposer" | null>(null);
  const [panelOpen, setPanelOpen] = useState(false);
  const [sessionInfoOpen, setSessionInfoOpen] = useState(false);
  const [textComposerOpen, setTextComposerOpen] = useState(false);
  const isNarrowScreen = useIsNarrowScreen();
  const effectiveForceOpen = forceOpen && activeSurface === null;
  const open = effectiveForceOpen || panelOpen;

  const handleOpenChange = (nextOpen: boolean) => {
    if (effectiveForceOpen && !nextOpen) {
      return;
    }

    setPanelOpen(nextOpen);
  };

  const handleSessionInfoOpenChange = (nextOpen: boolean) => {
    setSessionInfoOpen(nextOpen);
    setActiveSurface((current) => {
      if (nextOpen) {
        return "sessionInfo";
      }
      return current === "sessionInfo" ? null : current;
    });
  };

  const handleTextComposerOpenChange = (nextOpen: boolean) => {
    setTextComposerOpen(nextOpen);
    setActiveSurface((current) => {
      if (nextOpen) {
        return "textComposer";
      }
      return current === "textComposer" ? null : current;
    });
  };

  const handleOpenSessionInfo = () => {
    setPanelOpen(false);
    handleSessionInfoOpenChange(true);
  };

  const handleOpenTextComposer = () => {
    if (!textActionsEnabled) {
      return;
    }

    setPanelOpen(false);
    handleTextComposerOpenChange(true);
  };

  const morePanelBody = (
    <div data-testid="android-more-panel" className="space-y-3">
      <div className="text-[11px] font-medium uppercase tracking-[0.16em] text-zinc-400">更多操作</div>
      <div className="flex flex-wrap items-center gap-2">
        <Button
          data-testid="android-info-button"
          aria-label="打开调试信息"
          size="icon"
          title="调试信息"
          variant="secondary"
          onClick={handleOpenSessionInfo}
        >
          <Info className="size-4" />
        </Button>
        <Button
          data-testid="android-reconnect-button"
          aria-label="重新连接"
          title="重新连接"
          size="icon"
          variant="secondary"
          disabled={!reconnectEnabled}
          onClick={() => {
            setPanelOpen(false);
            onReconnect();
          }}
        >
          <RefreshCw className="size-4" />
        </Button>
        <Button
          data-testid="android-text-input-trigger"
          aria-label="打开文本输入"
          size="icon"
          title={textActionsEnabled ? "发送文本" : textInputHint.title}
          variant="secondary"
          disabled={!textActionsEnabled}
          onClick={handleOpenTextComposer}
        >
          <Keyboard className="size-4" />
        </Button>
        <OnlyDebug>
          {directExperiment != null ? (
            <AndroidDirectExperimentPanel {...directExperiment} isNarrowScreen={isNarrowScreen} />
          ) : null}
        </OnlyDebug>
      </div>
      {showPerformanceControls ? (
        <div className="rounded-2xl border border-white/10 bg-black/30 px-3 py-2 text-xs text-zinc-200">
          <div className="flex items-center justify-between gap-2">
            <span className="text-[11px] font-medium uppercase tracking-[0.16em] text-zinc-400">流畅度</span>
            <span data-testid="android-performance-meta" className="text-[11px] text-zinc-400">
              {performanceControls?.performanceMeta ?? "-"}
            </span>
          </div>
          <div className="mt-2 grid grid-cols-3 gap-2">
            {ANDROID_PERFORMANCE_PROFILES.map((profileOption) => {
              const optionLabel = resolveAndroidPerformanceTuning(profileOption).label;
              const performanceProfile = performanceControls?.performanceProfile;
              return (
                <Button
                  key={profileOption}
                  data-testid={`android-performance-profile-${profileOption}`}
                  aria-pressed={performanceProfile === profileOption}
                  size="sm"
                  variant={performanceProfile === profileOption ? "default" : "secondary"}
                  disabled={performanceControls == null}
                  onClick={() => {
                    if (performanceProfile === profileOption) {
                      return;
                    }
                    performanceControls?.onPerformanceProfileChange(profileOption);
                  }}
                >
                  {optionLabel}
                </Button>
              );
            })}
          </div>
        </div>
      ) : null}
    </div>
  );

  return (
    <>
      {isNarrowScreen ? (
        <>
          <Button
            data-testid="android-more-button"
            aria-label="更多操作"
            title="更多操作"
            size="icon"
            variant="secondary"
            className="rounded-md border-0 bg-zinc-900 text-white shadow-none hover:bg-zinc-800"
            onClick={() => handleOpenChange(true)}
          >
            <Ellipsis className="size-4" />
          </Button>
          <Sheet open={open} onOpenChange={handleOpenChange}>
            <SheetContent side="bottom" aria-describedby={undefined} className="border-white/10 bg-zinc-950 text-white">
              <SheetHeader>
                <SheetTitle>更多操作</SheetTitle>
              </SheetHeader>
              <div className="mt-4">{morePanelBody}</div>
            </SheetContent>
          </Sheet>
        </>
      ) : (
        <Popover open={open} onOpenChange={handleOpenChange}>
          <PopoverTrigger asChild>
            <Button
              data-testid="android-more-button"
              aria-label="更多操作"
              title="更多操作"
              size="icon"
              variant="secondary"
              className="rounded-md border-0 bg-zinc-900 text-white shadow-none hover:bg-zinc-800"
            >
              <Ellipsis className="size-4" />
            </Button>
          </PopoverTrigger>
          <PopoverContent
            align="end"
            side="top"
            sideOffset={10}
            className="w-[min(92vw,320px)] rounded-3xl border-white/10 bg-zinc-950/98 p-3 text-white shadow-2xl"
          >
            {morePanelBody}
          </PopoverContent>
        </Popover>
      )}

      <AndroidSessionInfoDialog
        open={sessionInfoOpen}
        onOpenChange={handleSessionInfoOpenChange}
        sessionDebugItems={sessionDebugItems}
        sessionInfoItems={sessionInfoItems}
      />
      <AndroidTextComposerAction
        open={textComposerOpen}
        onOpenChange={handleTextComposerOpenChange}
        onSendText={onSendText}
        textActionsEnabled={textActionsEnabled}
      />
    </>
  );
}
