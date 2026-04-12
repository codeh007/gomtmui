"use client";
import { SidebarInset, SidebarProvider } from "mtxuilib/ui/sidebar";
import { AisdkChatSidebarLazy } from "./dynamics";
export default function AgentPage() {
  return (
    <SidebarProvider>
      <AisdkChatSidebarLazy />
      <SidebarInset>{/* <AisdkChatContent /> */}</SidebarInset>
    </SidebarProvider>
  );
}
