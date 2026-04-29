"use client";

import { DashContent, DashHeaders } from "@/components/dash-layout";
import { ConfigListView } from "@/components/gomtm-configs/config-list-view";

export default function GomtmConfigsPage() {
  return (
    <>
      <DashHeaders>
        <div className="flex flex-col">
          <h1 className="text-lg font-semibold">GOMTM 配置</h1>
          <p className="text-xs text-muted-foreground">管理可发布的 gomtm worker profiles，并生成 Linux 受管启动命令</p>
        </div>
      </DashHeaders>
      <DashContent className="flex flex-col gap-6 overflow-auto p-4 md:p-6">
        <div className="mr-auto flex w-full max-w-6xl flex-col gap-6">
          <ConfigListView />
        </div>
      </DashContent>
    </>
  );
}
