"use client";

import { FlaskConical, LoaderCircle } from "lucide-react";
import { cn } from "mtxuilib/lib/utils";
import { Button } from "mtxuilib/ui/button";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "mtxuilib/ui/collapsible";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "mtxuilib/ui/sheet";
import { useEffect, useMemo, useRef, useState } from "react";
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

function stringifyDirectPayload(value: unknown) {
  if (value == null) {
    return "尚无结果";
  }
  if (typeof value === "string") {
    return value;
  }

  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
}

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
    <div data-testid="android-direct-experiment-panel" className="space-y-3">
      <div className="space-y-1">
        <div className="text-[11px] font-medium uppercase tracking-[0.16em] text-zinc-400">直连实验</div>
        <div className="text-xs leading-5 text-zinc-300">
          direct-only 命中 Android 侧 direct lane，不走普通请求 fallback。
        </div>
      </div>

      <div className="rounded-2xl border border-white/10 bg-black/30 px-3 py-2 text-xs text-zinc-200">
        <div className="text-[11px] uppercase tracking-[0.16em] text-zinc-500">Direct 证据摘要</div>
        <div data-testid="android-direct-experiment-evidence" className="mt-2 text-xs leading-5 text-zinc-100">
          {directEvidenceSummary}
        </div>
      </div>

      <div className="rounded-2xl border border-white/10 bg-black/30 px-3 py-2 text-xs text-zinc-200">
        <div className="text-[11px] uppercase tracking-[0.16em] text-zinc-500">Candidate Pair 摘要</div>
        <div data-testid="android-direct-experiment-candidate-pair" className="mt-2 text-xs leading-5 text-zinc-100">
          {candidatePairSummary}
        </div>
      </div>

      <div className="rounded-2xl border border-white/10 bg-black/30 px-3 py-2 text-xs text-zinc-200">
        <div className="text-[11px] uppercase tracking-[0.16em] text-zinc-500">Direct 状态</div>
        <div
          data-testid="android-direct-experiment-status"
          className={cn(
            "mt-2 font-mono text-xs text-zinc-100",
            state === "direct_ready" && "text-emerald-200",
            state === "direct_not_established" && "text-amber-200",
            state === "signaling" && "text-sky-200",
          )}
        >
          {state}
        </div>
      </div>

      <div className="rounded-2xl border border-white/10 bg-black/30 px-3 py-2 text-xs text-zinc-200">
        <div className="text-[11px] uppercase tracking-[0.16em] text-zinc-500">
          {lastError != null ? "最近一次错误" : "最近一次结果"}
        </div>
        <pre
          data-testid="android-direct-experiment-result"
          className={cn(
            "mt-2 max-h-40 overflow-auto whitespace-pre-wrap break-all rounded-xl bg-black/40 p-2 font-mono text-[11px] leading-5 text-zinc-100",
            lastError != null && "text-rose-200",
          )}
        >
          {detail}
        </pre>
      </div>

      <Button
        data-testid="android-direct-experiment-run"
        className="w-full"
        disabled={!canRun || isRunning}
        onClick={() => {
          void handleRun();
        }}
      >
        {isRunning ? (
          <>
            <LoaderCircle className="size-4 animate-spin" />
            直连测试中...
          </>
        ) : (
          "开始直连测试"
        )}
      </Button>
    </div>
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
