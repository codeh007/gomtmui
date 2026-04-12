"use client";

import { Tabs, TabsContent, TabsList, TabsTrigger } from "mtxuilib/ui/tabs";
import { DashContent, DashHeaders } from "@/components/dash-layout";
import { JobQueueDlqList } from "@/components/job-queue/JobQueueDlqList";
import { JobQueueStats } from "@/components/job-queue/JobQueueStats";

export default function JobQueuePage() {
  return (
    <>
      <DashHeaders>
        <div className="flex flex-col">
          <h1 className="text-lg font-semibold">Job Queue</h1>
          <p className="text-xs text-muted-foreground">异步任务队列监控</p>
        </div>
      </DashHeaders>

      <DashContent className="flex flex-col gap-4 p-4 md:p-6 overflow-hidden">
        <JobQueueStats />

        <Tabs defaultValue="q_default" className="space-y-4 flex-1 flex flex-col min-h-0">
          <TabsList>
            <TabsTrigger value="q_default">Default Queue</TabsTrigger>
            <TabsTrigger value="q_system">System Queue</TabsTrigger>
            <TabsTrigger value="q_critical">Critical Queue</TabsTrigger>
          </TabsList>
          <div className="flex-1 overflow-auto min-h-0">
            <TabsContent value="q_default" className="space-y-4 h-full">
              <JobQueueDlqList queueName="q_default" />
            </TabsContent>
            <TabsContent value="q_system" className="space-y-4 h-full">
              <JobQueueDlqList queueName="q_system" />
            </TabsContent>
            <TabsContent value="q_critical" className="space-y-4 h-full">
              <JobQueueDlqList queueName="q_critical" />
            </TabsContent>
          </div>
        </Tabs>
      </DashContent>
    </>
  );
}
