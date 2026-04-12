"use client";

import { Loader2 } from "lucide-react";
import { useRpcQuery } from "mtmsdk/supabase/use-sb-query/use-rpc-query";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "mtxuilib/ui/breadcrumb";
import { Button } from "mtxuilib/ui/button";
import { SidebarInset } from "mtxuilib/ui/sidebar";
import { useParams, useRouter } from "next/navigation";
import { z } from "zod";
import { getPlatformIcon } from "@/components/cloud-account/platform-icons";
import { CloudAccountRecordSchema } from "@/components/cloud-account/schemas";
import { DashHeaders, DashRoot } from "@/components/dash-layout";
import { getSingleRouteParam } from "@/lib/route-params";

export default function Layout({ children }: { children: React.ReactNode }) {
  const params = useParams<{ id?: string | string[] }>();
  const id = getSingleRouteParam(params?.id);
  const router = useRouter();

  const {
    data: accounts,
    isLoading,
    error,
  } = useRpcQuery(
    "cloud_account_get",
    { p_id: id ?? "" },
    { schema: z.array(CloudAccountRecordSchema), enabled: !!id },
  );
  const account = accounts?.[0];

  if (isLoading) {
    return (
      <DashRoot className="h-svh overflow-hidden bg-muted/5">
        <SidebarInset className="h-full overflow-hidden flex flex-col items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </SidebarInset>
      </DashRoot>
    );
  }

  if (error || !account) {
    return (
      <DashRoot className="h-svh overflow-hidden bg-muted/5">
        <SidebarInset className="h-full overflow-hidden flex flex-col items-center justify-center gap-4">
          <div className="text-muted-foreground">Account not found or error loading account.</div>
          <Button onClick={() => router.push("/dash/cloud-accounts")}>Go Back</Button>
        </SidebarInset>
      </DashRoot>
    );
  }

  const PlatformIcon = getPlatformIcon(account.platform_name);

  return (
    <DashRoot className="h-svh overflow-hidden bg-muted/5">
      <SidebarInset className="h-full overflow-hidden flex flex-col">
        <DashHeaders>
          <Breadcrumb>
            <BreadcrumbList>
              <BreadcrumbItem className="hidden md:block">
                <BreadcrumbLink href="/dash">Dashboard</BreadcrumbLink>
              </BreadcrumbItem>
              <BreadcrumbSeparator className="hidden md:block" />
              <BreadcrumbItem>
                <BreadcrumbLink href="/dash/cloud-accounts">Cloud Accounts</BreadcrumbLink>
              </BreadcrumbItem>
              <BreadcrumbSeparator className="hidden md:block" />
              <BreadcrumbItem>
                <BreadcrumbPage className="flex items-center gap-2">
                  <PlatformIcon className="h-4 w-4" />
                  {account.account_name || account.account_email || "Unnamed Info"}
                </BreadcrumbPage>
              </BreadcrumbItem>
            </BreadcrumbList>
          </Breadcrumb>
        </DashHeaders>

        <div className="flex flex-1 flex-col space-y-8 p-8 md:flex overflow-y-auto">
          <div className="flex-1 lg:max-w-4xl">{children}</div>
        </div>
      </SidebarInset>
    </DashRoot>
  );
}
