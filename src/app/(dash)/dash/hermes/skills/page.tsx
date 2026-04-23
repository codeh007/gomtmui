import { DashContent, DashHeaders } from "@/components/dash-layout";
import { HermesSkillsPage } from "@/components/hermes/pages/skills-page";
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
        <HermesShell title="Skills" description="浏览 Hermes skills 与 toolsets 装配信息">
          <HermesSkillsPage />
        </HermesShell>
      </DashContent>
    </>
  );
}
