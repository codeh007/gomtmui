"use client";

import { ArrowLeft, Circle, Square } from "lucide-react";
import { cn } from "mtxuilib/lib/utils";
import { Button } from "mtxuilib/ui/button";
import type { AndroidDeviceNavigationBarProps } from "./p2p-android-viewport-control-rail";

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
