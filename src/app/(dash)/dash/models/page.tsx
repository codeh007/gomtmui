"use client";

import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "mtxuilib/ui/breadcrumb";
import { DashContent, DashHeaders } from "@/components/dash-layout";
import { ModelListView } from "@/components/models/ModelListView";

export default function ModelsPage() {
  return (
    <>
      <DashHeaders>
        <Breadcrumb>
          <BreadcrumbList>
            <BreadcrumbItem>
              <BreadcrumbLink href="/dash">Dashboard</BreadcrumbLink>
            </BreadcrumbItem>
            <BreadcrumbSeparator />
            <BreadcrumbItem>
              <BreadcrumbPage>AI Models</BreadcrumbPage>
            </BreadcrumbItem>
          </BreadcrumbList>
        </Breadcrumb>
      </DashHeaders>

      <DashContent className="flex-1 overflow-auto p-4">
        <ModelListView />
      </DashContent>
    </>
  );
}
