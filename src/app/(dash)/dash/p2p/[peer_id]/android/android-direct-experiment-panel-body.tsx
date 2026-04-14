import { LoaderCircle } from "lucide-react";
import { cn } from "mtxuilib/lib/utils";
import { Button } from "mtxuilib/ui/button";

export function AndroidDirectExperimentPanelBody({
  candidatePairSummary,
  detail,
  directEvidenceSummary,
  isRunning,
  lastError,
  onRun,
  state,
}: {
  candidatePairSummary: string;
  detail: string;
  directEvidenceSummary: string;
  isRunning: boolean;
  lastError: string | null;
  onRun: () => void;
  state: string;
}) {
  return (
    <div data-testid="android-direct-experiment-panel" className="space-y-3">
      <div className="space-y-1">
        <div className="text-[11px] font-medium uppercase tracking-[0.16em] text-zinc-400">直连实验</div>
        <div className="text-xs leading-5 text-zinc-300">direct-only 命中 Android 侧 direct lane，不走普通请求 fallback。</div>
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
        <div className="text-[11px] uppercase tracking-[0.16em] text-zinc-500">{lastError != null ? "最近一次错误" : "最近一次结果"}</div>
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

      <Button data-testid="android-direct-experiment-run" className="w-full" disabled={isRunning} onClick={onRun}>
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
}
