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
import { Separator } from "mtxuilib/ui/separator";
import { SidebarInset, SidebarTrigger } from "mtxuilib/ui/sidebar";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { z } from "zod";
import { getPlatformIcon } from "@/components/cloud-account/platform-icons";
import { CloudAccountRecordSchema } from "@/components/cloud-account/schemas";
import { DashRoot } from "@/components/dash-layout";

export default function Layout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: { platform: string; id: string };
}) {
  const { id, platform } = params;
  const pathname = usePathname() ?? "";
  const router = useRouter();

  const {
    data: accounts,
    isLoading,
    error,
  } = useRpcQuery("cloud_account_get", { p_id: id }, { schema: z.array(CloudAccountRecordSchema) });
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
  const baseUrl = `/dash/cloud-accounts/${platform}/${id}`;

  const navItems = [
    { label: "Overview", href: baseUrl, matchExact: true },
    { label: "Settings", href: `${baseUrl}/settings` },
  ];

  return (
    <DashRoot className="h-svh overflow-hidden bg-muted/5">
      <SidebarInset className="h-full overflow-hidden flex flex-col">
        <header className="flex h-16 shrink-0 items-center gap-2 border-b px-4 transition-[width,height] ease-linear group-has-[[data-collapsible=icon]]/sidebar-wrapper:h-12">
          <div className="flex items-center gap-2 px-4">
            <SidebarTrigger className="-ml-1" />
            <Separator orientation="vertical" className="mr-2 h-4" />
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
          </div>
        </header>

        <div className="flex flex-1 flex-col space-y-8 p-8 md:flex">
          <div className="flex flex-col space-y-2">
            <h2 className="text-2xl font-bold tracking-tight">{account.account_name || account.account_email}</h2>
            <p className="text-muted-foreground">
              Manage your {account.platform_name} account settings and preferences.
            </p>
          </div>
          <div className="flex flex-col space-y-8 lg:flex-row lg:space-x-12 lg:space-y-0">
            <aside className="-mx-4 lg:w-1/5">
              <nav className="flex space-x-2 lg:flex-col lg:space-x-0 lg:space-y-1">
                {navItems.map((item) => {
                  const isActive = item.matchExact ? pathname === item.href : pathname.startsWith(item.href);
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      className={`justify-start rounded-md p-2 hover:bg-muted ${
                        isActive ? "bg-muted font-semibold text-primary" : "text-muted-foreground"
                      } block px-3 py-2 text-sm font-medium transition-colors`}
                    >
                      {item.label}
                    </Link>
                  );
                })}
              </nav>
            </aside>
            <div className="flex-1 lg:max-w-4xl">{children}</div>
          </div>
        </div>
      </SidebarInset>
    </DashRoot>
  );
}
