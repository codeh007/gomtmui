import { LoaderCircle } from "lucide-react";
import { cn } from "mtxuilib/lib/utils";
import type { AndroidRemoteStatusView } from "./p2p-android-viewport-support";

type AndroidNativeV2StatusOverlayProps = {
  capabilityDetail: string;
  capabilityLabel: string;
  remoteStatus: AndroidRemoteStatusView;
};

export function AndroidNativeV2StatusOverlay({
  capabilityDetail,
  capabilityLabel,
  remoteStatus,
}: AndroidNativeV2StatusOverlayProps) {
  if (remoteStatus.label === "Connected") {
    return null;
  }

  return (
    <div className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center p-4">
      <div
        className={cn(
          "inline-flex max-w-sm items-center gap-2 rounded-2xl border border-white/10 bg-black/75 px-4 py-3 text-sm text-white shadow-2xl backdrop-blur-md",
          remoteStatus.label === "Error" && "border-rose-500/40 text-rose-100",
          remoteStatus.label === "Connecting" && "border-sky-400/40 text-sky-100",
          remoteStatus.label === "Unsupported" && "border-amber-400/40 text-amber-100",
        )}
      >
        {remoteStatus.label === "Connecting" ? (
          <LoaderCircle className="size-4 shrink-0 animate-spin text-current" />
        ) : null}
        <div className="min-w-0 text-center leading-5">
          {remoteStatus.label === "Unsupported" ? (
            <div className="space-y-1">
              <div className="text-sm font-medium">{capabilityLabel}</div>
              <div className="text-xs text-current/80">{capabilityDetail}</div>
            </div>
          ) : (
            remoteStatus.detail
          )}
        </div>
      </div>
    </div>
  );
}
