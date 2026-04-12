"use client";
import { PlusIcon, Search } from "lucide-react";
import { randomUUID } from "mtxuilib/lib/utils";
import { DebugValue } from "mtxuilib/mt/DebugValue";
import { Button } from "mtxuilib/ui/button";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
} from "mtxuilib/ui/sidebar";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useChatHistory } from "@/components/chatv2/hooks/use-chat-history";

export function AisdkChatSidebar() {
  const router = useRouter();
  const handleNewChat = () => {
    router.push(`/chat/${randomUUID()}`);
  };

  return (
    <Sidebar>
      <SidebarHeader className="flex flex-row items-center justify-between gap-2 px-2 py-4">
        <div className="flex flex-row items-center gap-2 px-2">
          <div className="bg-primary/10 size-8 rounded-md"></div>
          <div className="text-md font-base text-primary tracking-tight">zola.chat</div>
        </div>
        <Button variant="ghost" className="size-8">
          <Search className="size-4" />
        </Button>
      </SidebarHeader>
      <SidebarContent className="pt-1">
        <div className="px-4">
          <Button
            variant="outline"
            className="mb-4 flex w-full items-center gap-2"
            onClick={() => {
              handleNewChat();
            }}
          >
            <PlusIcon className="size-4" />
            <span>新对话</span>
          </Button>
        </div>
        <ChatHisttorySidebarGroup agentId="assisant" />
      </SidebarContent>
    </Sidebar>
  );
}

export interface useChatHistoryProps {
  agentId: string;
}
export const ChatHisttorySidebarGroup = ({ agentId }: useChatHistoryProps) => {
  const groupedChatHistory = useChatHistory({
    agentId,
  });
  return (
    <>
      {groupedChatHistory.map((group) => (
        <SidebarGroup key={group.groupLabel}>
          <SidebarGroupLabel>
            {group.groupLabel} <DebugValue data={groupedChatHistory} />
          </SidebarGroupLabel>
          <SidebarMenu>
            {group.items.map((conversation) => (
              <SidebarMenuButton key={conversation.id} asChild>
                <Link href={`/chat/${conversation.id}`}>
                  <span>{conversation.title}</span>
                </Link>
              </SidebarMenuButton>
            ))}
          </SidebarMenu>
        </SidebarGroup>
      ))}
    </>
  );
};
