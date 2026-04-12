"use client";

import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "mtxuilib/ui/breadcrumb";
import { Skeleton } from "mtxuilib/ui/skeleton";
import { useParams } from "next/navigation";
import { CampaignBuilder } from "@/components/campaigns/CampaignBuilder";
import { useCampaignGet } from "@/components/campaigns/hooks/use-campaigns";
import { DashContent, DashHeaders } from "@/components/dash-layout";
import { getSingleRouteParam } from "@/lib/route-params";

export default function EditCampaignPage() {
  const params = useParams<{ id?: string | string[] }>();
  const id = getSingleRouteParam(params?.id) ?? "";

  const { data: campaign, isLoading, error } = useCampaignGet(id);

  if (isLoading) {
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
                <BreadcrumbLink href="/dash/campaigns">推广活动</BreadcrumbLink>
              </BreadcrumbItem>
              <BreadcrumbSeparator />
              <BreadcrumbItem>
                <BreadcrumbPage>编辑活动</BreadcrumbPage>
              </BreadcrumbItem>
            </BreadcrumbList>
          </Breadcrumb>
        </DashHeaders>
        <DashContent className="p-4 md:p-6">
          <div className="mx-auto max-w-4xl space-y-8 py-8 px-4">
            <div className="flex items-center justify-between">
              <div className="space-y-2">
                <Skeleton className="h-8 w-48" />
                <Skeleton className="h-4 w-96" />
              </div>
            </div>
            <div className="space-y-8">
              <Skeleton className="h-64 w-full" />
              <Skeleton className="h-64 w-full" />
            </div>
          </div>
        </DashContent>
      </>
    );
  }

  if (error || !campaign) {
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
                <BreadcrumbLink href="/dash/campaigns">推广活动</BreadcrumbLink>
              </BreadcrumbItem>
              <BreadcrumbSeparator />
              <BreadcrumbItem>
                <BreadcrumbPage>编辑活动</BreadcrumbPage>
              </BreadcrumbItem>
            </BreadcrumbList>
          </Breadcrumb>
        </DashHeaders>
        <DashContent className="p-4 md:p-6">
          <div className="flex flex-col items-center justify-center py-20">
            <h2 className="text-xl font-semibold mb-2">未找到活动</h2>
            <p className="text-muted-foreground">该活动不存在或已被删除。</p>
          </div>
        </DashContent>
      </>
    );
  }

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
              <BreadcrumbLink href="/dash/campaigns">推广活动</BreadcrumbLink>
            </BreadcrumbItem>
            <BreadcrumbSeparator />
            <BreadcrumbItem>
              <BreadcrumbPage>编辑活动</BreadcrumbPage>
            </BreadcrumbItem>
          </BreadcrumbList>
        </Breadcrumb>
      </DashHeaders>
      <DashContent className="p-4 md:p-6">
        <CampaignBuilder initialData={campaign} mode="edit" />
      </DashContent>
    </>
  );
}
