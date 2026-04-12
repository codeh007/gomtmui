"use client";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "mtxuilib/ui/breadcrumb";
import { SidebarInset } from "mtxuilib/ui/sidebar";
import { DashContent, DashHeaders } from "@/components/dash-layout";
import { SidebarSettings } from "./sidebar";

export default function SettingsLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <SidebarSettings />
      <SidebarInset className="h-full overflow-hidden flex flex-col">
        <DashHeaders>
          <Breadcrumb>
            <BreadcrumbList>
              <BreadcrumbItem>
                <BreadcrumbLink href="/dash">控制台</BreadcrumbLink>
              </BreadcrumbItem>
              <BreadcrumbSeparator />
              <BreadcrumbItem>
                <BreadcrumbPage>设置</BreadcrumbPage>
              </BreadcrumbItem>
            </BreadcrumbList>
          </Breadcrumb>
        </DashHeaders>
        <DashContent className="flex-1 overflow-auto" innerClassName="p-6">
          {children}
        </DashContent>
      </SidebarInset>
    </>
  );
}
