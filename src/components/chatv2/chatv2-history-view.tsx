"use client";

import { HistoryIcon } from "lucide-react";
import { Button } from "mtxuilib/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "mtxuilib/ui/dialog";
import { BetterTooltip } from "mtxuilib/ui/tooltip";
import type { ChatAgent } from "./types";

export const ChatV2HistoryView = ({ chatAgent: _chatAgent }: { chatAgent: ChatAgent }) => {
  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="ghost" size="icon" className="rounded-full size-8">
          <BetterTooltip content="对话历史">
            <HistoryIcon className="size-4" />
          </BetterTooltip>
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>对话历史</DialogTitle>
        </DialogHeader>
        <div className="p-4">
          <p className="text-muted-foreground">暂无对话历史</p>
        </div>
      </DialogContent>
    </Dialog>
  );
};
