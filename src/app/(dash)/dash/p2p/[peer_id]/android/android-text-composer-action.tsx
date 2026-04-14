"use client";

import { Button } from "mtxuilib/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "mtxuilib/ui/dialog";
import { Input } from "mtxuilib/ui/input";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "mtxuilib/ui/sheet";
import { useState } from "react";
import { useIsNarrowScreen } from "./use-is-narrow-screen";

type AndroidTextComposerActionProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSendText: (text: string) => Promise<boolean>;
  textActionsEnabled: boolean;
};

export function AndroidTextComposerAction({
  open,
  onOpenChange,
  onSendText,
  textActionsEnabled,
}: AndroidTextComposerActionProps) {
  const isMobile = useIsNarrowScreen();
  const [textInput, setTextInput] = useState("");
  const textInputForm = (
    <div className="space-y-3">
      <form
        className="flex flex-col gap-2 sm:flex-row"
        onSubmit={(event) => {
          event.preventDefault();
          void (async () => {
            const text = textInput.trim();
            if (text === "") {
              return;
            }

            if (await onSendText(text)) {
              setTextInput("");
              onOpenChange(false);
            }
          })();
        }}
      >
        <Input
          value={textInput}
          onChange={(event) => setTextInput(event.target.value)}
          placeholder="输入文本后发送到当前聚焦控件"
          className="bg-white/95 text-black"
          disabled={!textActionsEnabled}
          autoFocus
        />
        <Button type="submit" disabled={!textActionsEnabled || textInput.trim() === ""}>
          发送文本
        </Button>
      </form>
    </div>
  );

  if (isMobile) {
    return (
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent side="bottom" aria-describedby={undefined} className="border-white/10 bg-zinc-950 text-white">
          <SheetHeader>
            <SheetTitle>发送文本</SheetTitle>
          </SheetHeader>
          <div className="mt-4">{textInputForm}</div>
        </SheetContent>
      </Sheet>
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[min(92vw,480px)] max-w-[480px] border-white/10 bg-zinc-950 text-white">
        <DialogHeader>
          <DialogTitle>发送文本</DialogTitle>
          <DialogDescription className="sr-only">发送文本到当前 Android 焦点控件。</DialogDescription>
        </DialogHeader>
        {textInputForm}
      </DialogContent>
    </Dialog>
  );
}
