"use client";

import { DashContent, DashHeaders } from "@/components/dash-layout";
import { EmptyConfigEditorView } from "@/components/gomtm-configs/config-editor-view";

export default function GomtmConfigCreatePage() {
  return (
    <>
      <DashHeaders>
        <div className="flex flex-col">
          <h1 className="text-lg font-semibold">新建配置</h1>
          <p className="text-xs text-muted-foreground">创建新的 gomtm worker profile，并从默认结构化配置开始编辑</p>
        </div>
      </DashHeaders>
      <DashContent className="flex flex-col gap-6 overflow-auto p-4 md:p-6">
        <div className="mr-auto flex w-full max-w-5xl flex-col gap-6">
          <EmptyConfigEditorView name="new-config" />
        </div>
      </DashContent>
    </>
  );
}
