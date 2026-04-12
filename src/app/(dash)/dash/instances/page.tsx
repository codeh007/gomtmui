"use client";

import { ErrorBoundary } from "@/components/common/error-boundary";
import { DashContent, DashHeaders } from "@/components/dash-layout";
import { ServerInstanceList } from "@/components/server-instance/server-instance-list";

export default function InstancesPage() {
  return (
    <>
      <DashHeaders>
        <div className="flex flex-col">
          <h1 className="text-lg font-semibold">服务实例 </h1>
        </div>
      </DashHeaders>
      <DashContent className="flex-1 overflow-auto">
        <ErrorBoundary name="ServerInstanceList">
          <ServerInstanceList />
        </ErrorBoundary>
      </DashContent>
    </>
  );
}
