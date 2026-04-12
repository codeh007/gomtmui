import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "mtxuilib/ui/dialog";
import type { AndroidSessionInfoItem } from "./p2p-android-viewport-support";

function renderSessionInfoSection(title: string, items: AndroidSessionInfoItem[]) {
  return (
    <section className="space-y-3">
      <div className="text-sm font-medium text-zinc-100">{title}</div>
      <dl className="space-y-2">
        {items.map((item) => (
          <div key={item.label} className="space-y-1 rounded-2xl border border-white/10 bg-black/30 px-3 py-2">
            <dt className="text-[11px] uppercase tracking-[0.16em] text-zinc-500">{item.label}</dt>
            <dd className="break-all text-sm text-zinc-100">{item.value}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}

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
          {renderSessionInfoSection("云机信息", sessionInfoItems)}
          {renderSessionInfoSection("调试信息", sessionDebugItems)}
        </div>
      </DialogContent>
    </Dialog>
  );
}
