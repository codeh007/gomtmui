"use client";

import { readStoredProxyEndpoint, writeStoredProxyEndpoint } from "@/components/mproxy/schemas";
import { DashContent, DashHeaders } from "@/components/dash-layout";
import { ErrorBoundary } from "@/components/common/error-boundary";
import { ExtractRecordsCard } from "@/components/mproxy/extract-records-card";
import { MitmCaCard } from "@/components/mproxy/mitm-ca-card";
import { NodePoolCard } from "@/components/mproxy/node-pool-card";
import { SubscriptionImportCard } from "@/components/mproxy/subscription-import-card";
import { useGomtmServer } from "@/lib/gomtm-server/provider";
import { useEffect, useState } from "react";

export default function MProxyPage() {
  const [proxyEndpoint, setProxyEndpoint] = useState("");
  const { defaultServerUrl, serverUrl } = useGomtmServer();
  const selectedServerOrigin = serverUrl || defaultServerUrl;

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
          <p>提取记录现在同时暴露运行模式和入口策略，VMess 输出则表示进入当前选中的 gomtm server wrapper。</p>
			<p className="mt-1">选择 <code>mitm</code> 后，客户端在使用 HTTPS 前需要先导入根证书；VMess profile/subscription 会跟随当前 gomtm server 与其当前运行配置。</p>
          <p className="mt-1">当前 gomtm server：<code>{selectedServerOrigin || "未配置"}</code></p>
        </div>
        <ErrorBoundary name="MitmCaCard">
          <MitmCaCard />
        </ErrorBoundary>
        <ErrorBoundary name="SubscriptionImportCard">
          <SubscriptionImportCard />
        </ErrorBoundary>
        <ErrorBoundary name="NodePoolCard">
          <NodePoolCard proxyEndpoint={proxyEndpoint} onProxyEndpointChange={setProxyEndpoint} />
        </ErrorBoundary>
        <ErrorBoundary name="ExtractRecordsCard">
          <ExtractRecordsCard
            onProxyEndpointChange={setProxyEndpoint}
            proxyEndpoint={proxyEndpoint}
            serverOrigin={selectedServerOrigin}
          />
        </ErrorBoundary>
      </DashContent>
    </>
  );
}
