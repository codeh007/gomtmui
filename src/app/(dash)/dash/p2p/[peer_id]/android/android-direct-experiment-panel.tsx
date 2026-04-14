"use client";

import { FlaskConical } from "lucide-react";
import { Button } from "mtxuilib/ui/button";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "mtxuilib/ui/collapsible";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "mtxuilib/ui/sheet";
import { useEffect, useMemo, useRef, useState } from "react";
import { AndroidDirectExperimentPanelBody } from "./android-direct-experiment-panel-body";
import { stringifyDirectPayload } from "./android-direct-experiment-panel-utils";
import type { AndroidDirectLaneState } from "./use-android-direct-lane";

type AndroidDirectExperimentPanelProps = {
  candidatePairSummary: string;
  canRun: boolean;
  directEvidenceSummary: string;
  isNarrowScreen: boolean;
  lastError: string | null;
  lastResult: unknown;
  onRun: () => Promise<unknown> | undefined;
  state: AndroidDirectLaneState;
};

export function AndroidDirectExperimentPanel({
  candidatePairSummary,
  canRun,
  directEvidenceSummary,
  isNarrowScreen,
  lastError,
  lastResult,
  onRun,
  state,
}: AndroidDirectExperimentPanelProps) {
  const [open, setOpen] = useState(false);
  const [isLocalPending, setIsLocalPending] = useState(false);
  const isMountedRef = useRef(true);
  const localPendingRef = useRef(false);
  const isRunning = state === "signaling" || isLocalPending;
  const detail = useMemo(() => stringifyDirectPayload(lastError ?? lastResult), [lastError, lastResult]);

  useEffect(() => {
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  async function handleRun() {
    if (!canRun || localPendingRef.current || state === "signaling") {
      return;
    }

    localPendingRef.current = true;
    setIsLocalPending(true);

    try {
      await onRun();
    } catch {
      // 避免实验按钮把失败冒泡成未处理 Promise。
    } finally {
      localPendingRef.current = false;
      if (isMountedRef.current) {
        setIsLocalPending(false);
      }
    }
  }

  const panelBody = (
    <AndroidDirectExperimentPanelBody
      candidatePairSummary={candidatePairSummary}
      detail={detail}
      directEvidenceSummary={directEvidenceSummary}
      isRunning={!canRun || isRunning}
      lastError={lastError}
      onRun={() => {
        void handleRun();
      }}
      state={state}
    />
  );

  if (isNarrowScreen) {
    return (
      <>
        <Button
          data-testid="android-direct-experiment-trigger"
          aria-label="打开直连实验面板"
          title="直连实验"
          size="icon"
          variant="secondary"
          className="rounded-md border-0 bg-zinc-900 text-white shadow-none hover:bg-zinc-800"
          onClick={() => setOpen(true)}
        >
          <FlaskConical className="size-4" />
        </Button>
        <Sheet open={open} onOpenChange={setOpen}>
          <SheetContent side="bottom" aria-describedby={undefined} className="border-white/10 bg-zinc-950 text-white">
            <SheetHeader>
              <SheetTitle>直连实验</SheetTitle>
            </SheetHeader>
            <div className="mt-4">{panelBody}</div>
          </SheetContent>
        </Sheet>
      </>
    );
  }

  return (
    <Collapsible open={open} onOpenChange={setOpen} className="relative md:w-full">
      <CollapsibleTrigger asChild>
        <Button
          data-testid="android-direct-experiment-trigger"
          aria-label="打开直连实验面板"
          title="直连实验"
          size="icon"
          variant="secondary"
          className="rounded-md border-0 bg-zinc-900 text-white shadow-none hover:bg-zinc-800"
        >
          <FlaskConical className="size-4" />
        </Button>
      </CollapsibleTrigger>
      <CollapsibleContent className="absolute bottom-full right-0 z-20 mb-2 w-[min(20rem,calc(100vw-1rem))] rounded-3xl border border-white/10 bg-zinc-950/98 p-3 text-white shadow-2xl md:bottom-auto md:right-full md:top-0 md:mb-0 md:mr-2">
        {panelBody}
      </CollapsibleContent>
    </Collapsible>
  );
}
