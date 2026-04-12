"use client";

import { Edit } from "lucide-react";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "mtxuilib/ui/breadcrumb";
import { Button } from "mtxuilib/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "mtxuilib/ui/tabs";
import Link from "next/link";
import { CampaignStatsView } from "@/components/campaigns/CampaignStatsView";
import { useCampaignGet } from "@/components/campaigns/hooks/use-campaigns";
import { DashContent, DashHeaders } from "@/components/dash-layout";

export default function CampaignDetailPage({ params }: { params: { id: string } }) {
  const { data: campaign } = useCampaignGet(params.id);

  return (
    <div className="flex flex-col h-full">
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
              <BreadcrumbPage>{campaign?.name || "Loading..."}</BreadcrumbPage>
            </BreadcrumbItem>
          </BreadcrumbList>
        </Breadcrumb>
      </DashHeaders>

      <DashContent className="p-4 md:p-6 overflow-auto">
        <div className="flex justify-between items-center mb-6">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">{campaign?.name}</h1>
            <p className="text-muted-foreground text-sm">{campaign?.description || "No description"}</p>
          </div>
          <Button asChild variant="outline" size="sm">
            <Link href={`/dash/campaigns/${params.id}/edit`}>
              <Edit className="w-4 h-4 mr-2" />
              Configuration
            </Link>
          </Button>
        </div>

        <Tabs defaultValue="overview" className="space-y-4">
          <TabsList>
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="tasks">Tasks</TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="space-y-4 pt-2">
            <CampaignStatsView campaignId={params.id} />
          </TabsContent>

          <TabsContent value="tasks" className="pt-2">
            <div className="flex flex-col items-center justify-center p-12 text-center border rounded-lg bg-muted/5 border-dashed">
              <p className="text-muted-foreground">Detailed task list view is under construction.</p>
              <p className="text-xs text-muted-foreground mt-1">Please check Logs or Database for raw data.</p>
            </div>
          </TabsContent>
        </Tabs>
      </DashContent>
    </div>
  );
}
