import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "mtxuilib/ui/dialog";
import { AndroidSessionInfoSection } from "./android-session-info-section";
import type { AndroidSessionInfoItem } from "./p2p-android-viewport-support";

type AndroidSessionInfoDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  sessionDebugItems: AndroidSessionInfoItem[];
  sessionInfoItems: AndroidSessionInfoItem[];
};

export function AndroidSessionInfoDialog({
  open,
  onOpenChange,
  sessionDebugItems,
  sessionInfoItems,
}: AndroidSessionInfoDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[min(92vw,720px)] max-w-[720px] border-white/10 bg-zinc-950 text-white">
        <DialogHeader>
          <DialogTitle>调试信息</DialogTitle>
          <DialogDescription className="sr-only">查看当前 Android 远控页的调试信息。</DialogDescription>
        </DialogHeader>
        <div className="grid max-h-[70vh] gap-4 overflow-y-auto pr-1 lg:grid-cols-2">
          <AndroidSessionInfoSection title="云机信息" items={sessionInfoItems} />
          <AndroidSessionInfoSection title="调试信息" items={sessionDebugItems} />
        </div>
      </DialogContent>
    </Dialog>
  );
}
