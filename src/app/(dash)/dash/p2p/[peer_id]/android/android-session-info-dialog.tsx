import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "mtxuilib/ui/dialog";
import { AndroidSessionInfoSection } from "./android-session-info-section";
import type { AndroidSessionInfoItem } from "./p2p-android-viewport-support";

type AndroidSessionInfoDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  sessionInfoItems: AndroidSessionInfoItem[];
};

export function AndroidSessionInfoDialog({ open, onOpenChange, sessionInfoItems }: AndroidSessionInfoDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[min(92vw,560px)] max-w-[560px] border-white/10 bg-zinc-950 text-white">
        <DialogHeader>
          <DialogTitle>云机信息</DialogTitle>
          <DialogDescription className="sr-only">查看当前 Android 远控页的云机信息。</DialogDescription>
        </DialogHeader>
        <div className="max-h-[70vh] overflow-y-auto pr-1">
          <AndroidSessionInfoSection title="云机信息" items={sessionInfoItems} />
        </div>
      </DialogContent>
    </Dialog>
  );
}
