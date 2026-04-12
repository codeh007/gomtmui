"use client";

import { PlusIcon } from "@phosphor-icons/react";
import { Command, MoreHorizontal } from "lucide-react";
import { randomUUID } from "mtxuilib/lib/utils";
import { DebugValue, OnlyDebug } from "mtxuilib/mt/DebugValue";
import { Button } from "mtxuilib/ui/button";
import { CommandEmpty, CommandGroup, CommandInput, CommandList } from "mtxuilib/ui/command";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuShortcut,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "mtxuilib/ui/dropdown-menu";
import { SidebarTrigger } from "mtxuilib/ui/sidebar";
import { BetterTooltip } from "mtxuilib/ui/tooltip";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useSbSession } from "@/hooks/use-auth";
import { ChatV2HistoryView } from "./chatv2-history-view";
import { ChatV2SettingsView } from "./chatv2-settings-view";
import type { ChatAgent } from "./types";

export function Chatv2Header({ chatAgent }: { chatAgent: ChatAgent }) {
  const router = useRouter();
  return (
    <header className="bg-background z-10 flex h-16 w-full shrink-0 items-center gap-2 border-b px-4">
      <SidebarTrigger className="-ml-1" />
      <div className="flex-1">
        <h3 className="font-semibold text-base text-foreground">对话</h3>
      </div>
      {/* <div className="text-foreground">对话</div> */}
      <Button
        variant="ghost"
        size="icon"
        className="rounded-full size-8"
        onClick={() => {
          router.push(`/chat/${randomUUID()}`);
        }}
      >
        <BetterTooltip content="新建对话">
          <PlusIcon className="size-5" />
        </BetterTooltip>
      </Button>
      <ChatV2HistoryView chatAgent={chatAgent} />
      <ChatV2SettingsView chatAgent={chatAgent} />
      <ChatV2HeaderMoreActionsDropdown />
    </header>
  );
}

const ChatV2HeaderMoreActionsDropdown = () => {
  const [open, setOpen] = useState(false);
  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="sm">
          <MoreHorizontal />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-[200px]">
        <DropdownMenuLabel>操作</DropdownMenuLabel>
        <DropdownMenuGroup>
          <OnlyDebug>
            <DdMenuItem_SbSession />
          </OnlyDebug>
          <DropdownMenuSeparator />
          <DropdownMenuSub>
            <DropdownMenuSubTrigger>Apply label</DropdownMenuSubTrigger>
            <DropdownMenuSubContent className="p-0">
              <Command>
                <CommandInput placeholder="Filter label..." autoFocus={true} className="h-9" />
                <CommandList>
                  <CommandEmpty>No label found.</CommandEmpty>
                  <CommandGroup>
                    {/* {labels.map((label) => (
                        <CommandItem
                          key={label}
                          value={label}
                          onSelect={(value) => {
                            setLabel(value)
                            setOpen(false)
                          }}
                        >
                          {label}
                        </CommandItem>
                      ))} */}
                  </CommandGroup>
                </CommandList>
              </Command>
            </DropdownMenuSubContent>
          </DropdownMenuSub>
          <DropdownMenuSeparator />
          <DropdownMenuItem className="text-red-600">
            Delete
            <DropdownMenuShortcut>⌘⌫</DropdownMenuShortcut>
          </DropdownMenuItem>
        </DropdownMenuGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
};

const DdMenuItem_SbSession = () => {
  const sbSession = useSbSession();
  return (
    <DropdownMenuItem>
      sb session <DebugValue data={sbSession} />{" "}
    </DropdownMenuItem>
  );
};
