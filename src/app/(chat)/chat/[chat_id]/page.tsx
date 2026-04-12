"use client";
import { SidebarInset, SidebarProvider } from "mtxuilib/ui/sidebar";
import { use } from "react";
import { AisdkChatSidebarLazy, Chatv2Lazy } from "../dynamics";

export default function AgentPage({
  params,
}: {
  params: Promise<{
    chat_id: string;
  }>;
}) {
  const { chat_id } = use(params);
  return (
    <SidebarProvider>
      <AisdkChatSidebarLazy />
      <SidebarInset>
        <Chatv2Lazy sessionId={chat_id} />
      </SidebarInset>
    </SidebarProvider>
  );
}
