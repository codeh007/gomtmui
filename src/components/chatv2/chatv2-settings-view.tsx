"use client";

import { Settings } from "lucide-react";
import { Button } from "mtxuilib/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "mtxuilib/ui/dialog";
import { BetterTooltip } from "mtxuilib/ui/tooltip";
import type { ChatAgent } from "./types";

export const ChatV2SettingsView = ({ chatAgent: _chatAgent }: { chatAgent: ChatAgent }) => {
  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="ghost" size="icon" className="rounded-full size-8">
          <BetterTooltip content="设置">
            <Settings className="size-4" />
          </BetterTooltip>
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>设置</DialogTitle>
        </DialogHeader>
        <div className="p-4">
          <p className="text-muted-foreground">暂无可用设置</p>
        </div>
      </DialogContent>
    </Dialog>
  );
};
