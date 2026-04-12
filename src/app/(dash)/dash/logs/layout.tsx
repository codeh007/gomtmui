"use client";


import { SidebarInset } from "mtxuilib/ui/sidebar";
import { usePathname } from "next/navigation";
import { SidebarDash } from "../SidebarDash";

export default function LogsLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname() ?? "";
  return (
    <>
      <SidebarDash pathname={pathname} />
      <SidebarInset className="h-full overflow-hidden flex flex-col bg-muted/5">{children}</SidebarInset>
    </>
  );
}
