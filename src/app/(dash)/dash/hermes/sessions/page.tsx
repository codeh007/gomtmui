import { DashContent, DashHeaders } from "@/components/dash-layout";
import { HermesSessionsPage } from "@/components/hermes/pages/sessions-page";
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
        <HermesShell title="Sessions" description="浏览和搜索 Hermes 会话记录">
          <HermesSessionsPage />
        </HermesShell>
      </DashContent>
    </>
  );
}
