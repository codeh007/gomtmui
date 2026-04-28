"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2, ShieldAlert, ShieldCheck } from "lucide-react";
import { Button } from "mtxuilib/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "mtxuilib/ui/card";
import { useGomtmServer } from "@/lib/gomtm-server/provider";
import { useCurrentUserRole } from "@/hooks/use-current-user-role";
import { buildMproxyCaDownloadUrl, mproxyCaInitPath, mproxyCaStatePath, mproxyCaStateSchema } from "./schemas";
import { toast } from "sonner";

const caStateQueryKey = ["mproxy-ca-state"] as const;

export function MitmCaCard() {
  const queryClient = useQueryClient();
  const { defaultServerUrl, serverUrl } = useGomtmServer();
  const { isAdmin, isLoading: isRoleLoading } = useCurrentUserRole();
  const stateQuery = useQuery({
    queryKey: caStateQueryKey,
    queryFn: async () => {
      const response = await fetch(mproxyCaStatePath, {
        cache: "no-store",
        credentials: "same-origin",
      });
      const body = await response.json();
      if (!response.ok) {
        throw new Error(body.error ?? "CA 状态加载失败");
      }
      return mproxyCaStateSchema.parse(body);
    },
  });

  const initMutation = useMutation({
    mutationFn: async () => {
      const response = await fetch(mproxyCaInitPath, {
        credentials: "same-origin",
        method: "POST",
      });
      const body = await response.json();
      if (!response.ok) {
        throw new Error(body.error ?? "CA 初始化失败");
      }
      return mproxyCaStateSchema.parse(body);
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: caStateQueryKey });
      toast.success("MITM CA 已初始化");
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : "CA 初始化失败");
    },
  });

  const state = stateQuery.data;
  const caDownloadUrl = state?.download_path ? buildMproxyCaDownloadUrl(serverUrl || defaultServerUrl, state.download_path) : null;

  return (
    <Card>
      <CardHeader>
        <CardTitle>MITM CA</CardTitle>
        <CardDescription>MITM 模式使用环境级单 CA。证书元数据由数据库持久化，下载入口继续由 gomtm server 暴露。</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4 text-sm">
        <div className="rounded-lg border border-dashed p-4">
          <div className="flex items-start gap-3">
            {state?.initialized ? <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" /> : <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />}
            <div className="space-y-2">
              <div>
                <span className="font-medium">状态：</span>
                <span>{stateQuery.isLoading ? "加载中..." : state?.initialized ? "已初始化" : "未初始化"}</span>
              </div>
              <div>
                <span className="font-medium">下载：</span>
                <code>{state?.download_path ?? "/api/mproxy/mitm/ca.crt"}</code>
              </div>
              <div>
                <span className="font-medium">文件名：</span>
                <code>{state?.file_name ?? "gomtm-mitm-ca.crt"}</code>
              </div>
              {state?.subject_common_name ? (
                <div>
                  <span className="font-medium">主题：</span>
                  <span>{state.subject_common_name}</span>
                </div>
              ) : null}
              {state?.sha256_fingerprint ? (
                <div>
                  <span className="font-medium">SHA-256：</span>
                  <code className="break-all">{state.sha256_fingerprint}</code>
                </div>
              ) : null}
              {stateQuery.error ? <p className="text-destructive">{stateQuery.error.message}</p> : null}
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <Button
            type="button"
            onClick={() => initMutation.mutate()}
            disabled={isRoleLoading || !isAdmin || initMutation.isPending || state?.initialized === true}
          >
            {initMutation.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            初始化 CA
          </Button>
          {!isAdmin && !isRoleLoading ? <span className="text-xs text-muted-foreground">仅管理员可执行 CA 初始化。</span> : null}
          {caDownloadUrl ? (
            <a className="text-xs text-primary underline-offset-4 hover:underline" href={caDownloadUrl} rel="noreferrer" target="_blank">
              打开下载入口
            </a>
          ) : null}
        </div>
      </CardContent>
    </Card>
  );
}
