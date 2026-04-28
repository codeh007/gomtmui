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
          <p className="text-xs text-muted-foreground">导入订阅、管理直连/订阅上游，并为标准代理或 VMess 输出生成提取记录</p>
        </div>
      </DashHeaders>
      <DashContent className="flex flex-col gap-6 overflow-auto p-4 md:p-6">
        <div className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">
          <p>提取记录现在同时暴露运行模式和入口策略。</p>
          <p className="mt-1">选择 <code>mitm</code> 后，客户端在使用 HTTPS 前需要先导入 mproxy CA 证书；只有 VMess 上游会显示 VMess profile/subscription 输出。</p>
        </div>
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
