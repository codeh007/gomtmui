"use client";

import { SidebarInset } from "mtxuilib/ui/sidebar";
import { DashRoot } from "@/components/dash-layout";

export default function HostsLayout({ children }: { children: React.ReactNode }) {
  return (
    <DashRoot className="h-svh overflow-hidden bg-muted/5">
      <SidebarInset className="h-full overflow-hidden flex flex-col">{children}</SidebarInset>
    </DashRoot>
  );
}
