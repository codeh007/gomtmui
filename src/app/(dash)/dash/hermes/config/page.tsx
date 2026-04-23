import { DashContent, DashHeaders } from "@/components/dash-layout";
import { HermesConfigPage } from "@/components/hermes/pages/config-page";
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
        <HermesShell title="Config" description="浏览 Hermes 配置结构、默认值与模型信息">
          <HermesConfigPage />
        </HermesShell>
      </DashContent>
    </>
  );
}
