"use client";

import { useQuery } from "@tanstack/react-query";
import { DashContent, DashHeaders } from "@/components/dash-layout";
import { ConfigEditorView } from "@/components/gomtm-configs/config-editor-view";
import { fetchConfigProfile } from "@/lib/gomtm-configs/api";

export default function GomtmConfigDetailPage({ params }: { params: { name: string } }) {
  const profileName = params.name;
  const profileQuery = useQuery({
    queryKey: ["gomtm-config-profile", profileName],
    queryFn: () => fetchConfigProfile(profileName),
  });

  return (
    <>
      <DashHeaders>
        <div className="flex flex-col">
          <h1 className="text-lg font-semibold">配置详情</h1>
          <p className="text-xs text-muted-foreground">编辑 `{profileName}` 的 draft / published runtime 配置</p>
        </div>
      </DashHeaders>
      <DashContent className="flex flex-col gap-6 overflow-auto p-4 md:p-6">
        <div className="mr-auto flex w-full max-w-5xl flex-col gap-6">
          {profileQuery.isLoading ? <div className="text-sm text-muted-foreground">Loading...</div> : null}
          {profileQuery.isError ? (
            <div className="rounded-md border border-destructive/30 px-4 py-3 text-sm text-destructive">
              {profileQuery.error instanceof Error ? profileQuery.error.message : "加载配置失败"}
            </div>
          ) : null}
          {profileQuery.data ? <ConfigEditorView initialProfile={profileQuery.data} /> : null}
          {!profileQuery.isLoading && !profileQuery.isError && !profileQuery.data ? (
            <div className="text-sm text-muted-foreground">Not found.</div>
          ) : null}
        </div>
      </DashContent>
    </>
  );
}
