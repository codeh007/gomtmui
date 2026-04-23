import { DashContent, DashHeaders } from "@/components/dash-layout";
import { HermesStatusPage } from "@/components/hermes/pages/status-page";
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
        <HermesShell title="Status" description="Hermes 运行状态与摘要信息">
          <HermesStatusPage />
        </HermesShell>
      </DashContent>
    </>
  );
}
