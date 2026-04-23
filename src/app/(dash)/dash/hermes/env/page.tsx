import { DashContent, DashHeaders } from "@/components/dash-layout";
import { HermesEnvPage } from "@/components/hermes/pages/env-page";
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
        <HermesShell title="Keys" description="浏览 Hermes 环境变量与 provider 配置状态">
          <HermesEnvPage />
        </HermesShell>
      </DashContent>
    </>
  );
}
