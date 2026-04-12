"use client";
import { Breadcrumb, BreadcrumbItem, BreadcrumbLink, BreadcrumbList } from "mtxuilib/ui/breadcrumb";
import { DashContent, DashHeaders } from "@/components/dash-layout";
import { DashboardOverview } from "@/components/dashboard/overview";

export default function DashPage() {
  return (
    <>
      <DashHeaders>
        <Breadcrumb>
          <BreadcrumbList>
            <BreadcrumbItem>
              <BreadcrumbLink href="/dash">Dashboard</BreadcrumbLink>
            </BreadcrumbItem>
          </BreadcrumbList>
        </Breadcrumb>
      </DashHeaders>
      <DashContent className="h-full overflow-hidden" innerClassName="p-0">
        <main className="flex h-full flex-col flex-1 min-h-0 overflow-hidden">
          <DashboardOverview />
        </main>
      </DashContent>
    </>
  );
}
