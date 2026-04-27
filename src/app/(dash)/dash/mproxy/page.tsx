"use client";

import { readStoredProxyEndpoint, writeStoredProxyEndpoint } from "@/components/mproxy/schemas";
import { DashContent, DashHeaders } from "@/components/dash-layout";
import { ErrorBoundary } from "@/components/common/error-boundary";
import { ExtractRecordsCard } from "@/components/mproxy/extract-records-card";
import { NodePoolCard } from "@/components/mproxy/node-pool-card";
import { SubscriptionImportCard } from "@/components/mproxy/subscription-import-card";
import { useEffect, useState } from "react";

export default function MProxyPage() {
  const [proxyEndpoint, setProxyEndpoint] = useState("");

  useEffect(() => {
    setProxyEndpoint(readStoredProxyEndpoint());
  }, []);

  useEffect(() => {
    writeStoredProxyEndpoint(proxyEndpoint);
  }, [proxyEndpoint]);

  return (
    <>
      <DashHeaders>
        <div className="flex flex-col">
          <h1 className="text-lg font-semibold">代理</h1>
          <p className="text-xs text-muted-foreground">导入订阅、提取代理并管理路由记录</p>
        </div>
      </DashHeaders>
      <DashContent className="flex flex-col gap-6 overflow-auto p-4 md:p-6">
        <ErrorBoundary name="SubscriptionImportCard">
          <SubscriptionImportCard />
        </ErrorBoundary>
        <ErrorBoundary name="NodePoolCard">
          <NodePoolCard proxyEndpoint={proxyEndpoint} onProxyEndpointChange={setProxyEndpoint} />
        </ErrorBoundary>
        <ErrorBoundary name="ExtractRecordsCard">
          <ExtractRecordsCard proxyEndpoint={proxyEndpoint} onProxyEndpointChange={setProxyEndpoint} />
        </ErrorBoundary>
      </DashContent>
    </>
  );
}
