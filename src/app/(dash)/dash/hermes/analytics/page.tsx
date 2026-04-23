import { DashContent, DashHeaders } from "@/components/dash-layout";
import { HermesAnalyticsPage } from "@/components/hermes/pages/analytics-page";
import { HermesShell } from "@/components/hermes/hermes-shell";

export default function Page() {
  return (
    <>
      <DashHeaders>
        <div className="flex flex-col">
          <h1 className="text-lg font-semibold">Hermes</h1>
          <p className="text-xs text-muted-foreground">Hermes Agent 工作台</p>
        </div>
      </DashHeaders>
      <DashContent className="flex-1 overflow-auto">
        <HermesShell title="Analytics" description="查看 Hermes 使用量与模型统计">
          <HermesAnalyticsPage />
        </HermesShell>
      </DashContent>
    </>
  );
}
