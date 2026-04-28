"use client";

import { useQueryClient } from "@tanstack/react-query";
import { Check, Copy, ExternalLink, Loader2, Save, ShieldAlert, Trash2 } from "lucide-react";
import { useRpcMutation } from "mtmsdk/supabase/use-sb-query/use-rpc-mutation";
import { getRpcQueryKey, useRpcQuery } from "mtmsdk/supabase/use-sb-query/use-rpc-query";
import { Badge } from "mtxuilib/ui/badge";
import { Button } from "mtxuilib/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "mtxuilib/ui/card";
import { Input } from "mtxuilib/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "mtxuilib/ui/table";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import {
  buildVmessProfilePath,
  buildVmessSubscriptionPath,
  buildProxyUri,
  defaultExpiryValue,
  fromDateTimeLocalValue,
  mproxyExtractListSchema,
  mproxyExtractUpdateSchema,
  mproxyRpcNames,
  proxyEndpointSchema,
  toDateTimeLocalValue,
  trafficModeSchema,
  type MProxyExtractRow,
} from "./schemas";

type ExtractDraftMap = Record<
  string,
  {
    allowPlainProxy: boolean;
    allowVmessWrapper: boolean;
    disabled: boolean;
    expiresAt: string;
    trafficMode: "standard" | "mitm";
  }
>;

interface ExtractRecordsCardProps {
  proxyEndpoint: string;
  onProxyEndpointChange: (value: string) => void;
}

function getExtractDisplayName(row: MProxyExtractRow) {
  return row.display_name?.trim() || "未命名提取记录";
}

function getUpstreamDisplayName(row: MProxyExtractRow) {
  return row.upstream_tag?.trim() || row.upstream_source_name?.trim() || "未命名上游";
}

function normalizeTrafficMode(value: string | null) {
  return value === trafficModeSchema.enum.mitm ? trafficModeSchema.enum.mitm : trafficModeSchema.enum.standard;
}

export function ExtractRecordsCard({ proxyEndpoint, onProxyEndpointChange }: ExtractRecordsCardProps) {
  const queryClient = useQueryClient();
  const [drafts, setDrafts] = useState<ExtractDraftMap>({});
  const normalizedProxyEndpoint = useMemo(() => {
    if (!proxyEndpoint.trim()) {
      return "";
    }

    try {
      return proxyEndpointSchema.parse(proxyEndpoint);
    } catch {
      return "";
    }
  }, [proxyEndpoint]);

  const extractQuery = useRpcQuery(mproxyRpcNames.extractList, undefined, {
    schema: mproxyExtractListSchema,
  });
  const extracts = extractQuery.data ?? [];

  useEffect(() => {
    if (extracts.length === 0) {
      return;
    }

    setDrafts((previous) => {
      const next: ExtractDraftMap = {};
      for (const row of extracts) {
        if (!row.id) {
          continue;
        }

        next[row.id] = previous[row.id] ?? {
          allowPlainProxy: row.allow_plain_proxy ?? true,
          allowVmessWrapper: row.allow_vmess_wrapper ?? false,
          disabled: row.disabled ?? true,
          expiresAt: row.expires_at ? toDateTimeLocalValue(row.expires_at) : defaultExpiryValue(30),
          trafficMode: normalizeTrafficMode(row.traffic_mode),
        };
      }
      return next;
    });
  }, [extracts]);

  const updateMutation = useRpcMutation(mproxyRpcNames.extractUpdate);
  const deleteMutation = useRpcMutation(mproxyRpcNames.extractDelete);

  const handleUpdate = async (row: MProxyExtractRow) => {
    try {
      if (!row.id) {
        throw new Error("当前提取记录缺少 ID，无法保存");
      }

      const draft = drafts[row.id];
      if (!draft) {
        throw new Error("找不到待保存的草稿状态");
      }

      if (!draft.allowPlainProxy && !draft.allowVmessWrapper) {
        throw new Error("至少启用一个入口策略");
      }

      if (draft.allowVmessWrapper && row.upstream_protocol !== "vmess") {
        throw new Error("只有 VMess 上游可以启用 VMess 输出");
      }

      const result = await updateMutation.mutateAsync({
        p_allow_plain_proxy: draft.allowPlainProxy,
        p_allow_vmess_wrapper: draft.allowVmessWrapper,
        p_disabled: draft.disabled,
        p_expires_at: fromDateTimeLocalValue(draft.expiresAt),
        p_id: row.id,
        p_traffic_mode: draft.trafficMode,
      });
      if (result.error) {
        throw result.error;
      }

      mproxyExtractUpdateSchema.parse(result.data);
      await queryClient.invalidateQueries({ queryKey: getRpcQueryKey("mproxy_extract_list") });
      toast.success("提取记录已更新");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "提取记录更新失败");
    }
  };

  const handleDelete = async (id: string) => {
    try {
      const result = await deleteMutation.mutateAsync({ p_id: id });
      if (result.error) {
        throw result.error;
      }

      if (!result.data) {
        throw new Error("删除操作未成功完成");
      }

      await queryClient.invalidateQueries({ queryKey: getRpcQueryKey("mproxy_extract_list") });
      toast.success("提取记录已删除");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "提取记录删除失败");
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>提取记录</CardTitle>
        <CardDescription>通过 RPC 管理提取记录、运行模式和入口策略，并在支持时打开 VMess profile/subscription 输出。</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="mb-4 grid gap-2 rounded-lg border border-dashed p-4 md:grid-cols-[180px_minmax(0,1fr)] md:items-center">
          <span className="text-sm font-medium">代理入口</span>
          <div className="space-y-2">
            <Input
              value={proxyEndpoint}
              onChange={(event) => onProxyEndpointChange(event.target.value)}
              placeholder="例如：proxy.example.com:10085"
            />
            <p className="text-xs text-muted-foreground">标准代理 URI 复制使用这里显式配置的 mproxy 入口；VMess profile/subscription 输出走下方 API 路由。</p>
          </div>
        </div>

        <div className="overflow-x-auto rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>名称</TableHead>
                <TableHead>上游</TableHead>
                <TableHead>账号</TableHead>
                <TableHead>策略</TableHead>
                <TableHead>过期时间</TableHead>
                <TableHead>输出</TableHead>
                <TableHead className="text-right">操作</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {extractQuery.isLoading ? (
                <TableRow>
                  <TableCell colSpan={7} className="py-8 text-center text-muted-foreground">
                    提取记录加载中...
                  </TableCell>
                </TableRow>
              ) : extractQuery.isError ? (
                <TableRow>
                  <TableCell colSpan={7} className="py-8 text-center text-destructive">
                    {extractQuery.error instanceof Error ? extractQuery.error.message : "提取记录加载失败"}
                  </TableCell>
                </TableRow>
              ) : extracts.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="py-8 text-center text-muted-foreground">
                    暂无提取记录
                  </TableCell>
                </TableRow>
              ) : (
                extracts.map((row) => {
                  const rowId = row.id ?? `${row.username ?? "extract"}-${row.upstream_id ?? "unknown"}`;
                  const rowKey = row.id;
                  const draft = rowKey ? drafts[rowKey] : undefined;
                  const effectiveDraft = draft ?? {
                    allowPlainProxy: row.allow_plain_proxy ?? true,
                    allowVmessWrapper: row.allow_vmess_wrapper ?? false,
                    disabled: row.disabled ?? true,
                    expiresAt: row.expires_at ? toDateTimeLocalValue(row.expires_at) : defaultExpiryValue(30),
                    trafficMode: normalizeTrafficMode(row.traffic_mode),
                  };
                  const vmessProfileUrl = buildVmessRenderUrl(buildVmessProfilePath, row.id);
                  const vmessSubscriptionUrl = buildVmessRenderUrl(buildVmessSubscriptionPath, row.id);
                  const canPersist = Boolean(row.id);
                  const credentials = row.username && row.password ? { password: row.password, username: row.username } : null;
                  const canRenderPlain = effectiveDraft.allowPlainProxy && Boolean(credentials);
                  const canRenderVmess = effectiveDraft.allowVmessWrapper && row.upstream_protocol === "vmess" && Boolean(credentials);
                  const updateDraft = (mutate: (current: ExtractDraftMap[string]) => ExtractDraftMap[string]) => {
                    if (!rowKey) {
                      return;
                    }

                    setDrafts((previous) => ({
                      ...previous,
                      [rowKey]: mutate(previous[rowKey] ?? effectiveDraft),
                    }));
                  };

                  return (
                    <TableRow key={rowId}>
                      <TableCell>
                        <div className="font-medium">{getExtractDisplayName(row)}</div>
                        <div className="text-xs text-muted-foreground">{row.id ?? "无 ID"}</div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <span>{getUpstreamDisplayName(row)}</span>
                          {row.upstream_subscription_id ? null : <Badge variant="outline">直连</Badge>}
                        </div>
                        <div className="text-xs text-muted-foreground">{row.upstream_protocol ?? "未知协议"}</div>
                        <div className="text-xs text-muted-foreground">{row.upstream_source_name ?? "手动创建"}</div>
                      </TableCell>
                      <TableCell>
                        <div className="font-mono text-xs">{row.username ?? "缺少用户名"}</div>
                        <div className="font-mono text-xs text-muted-foreground">{row.password ?? "缺少密码"}</div>
                      </TableCell>
                      <TableCell>
                        <div className="space-y-2">
                          <Button
                            type="button"
                            variant={effectiveDraft.disabled ? "outline" : "secondary"}
                            size="sm"
                            onClick={() => updateDraft((current) => ({ ...current, disabled: !current.disabled }))}
                            disabled={!canPersist}
                          >
                            {effectiveDraft.disabled ? "已禁用" : "启用中"}
                          </Button>
                          <div className="flex flex-wrap gap-2">
                            <Button
                              type="button"
                              size="sm"
                              variant={effectiveDraft.trafficMode === trafficModeSchema.enum.standard ? "default" : "outline"}
                              onClick={() => updateDraft((current) => ({ ...current, trafficMode: trafficModeSchema.enum.standard }))}
                              disabled={!canPersist}
                            >
                              standard
                            </Button>
                            <Button
                              type="button"
                              size="sm"
                              variant={effectiveDraft.trafficMode === trafficModeSchema.enum.mitm ? "default" : "outline"}
                              onClick={() => updateDraft((current) => ({ ...current, trafficMode: trafficModeSchema.enum.mitm }))}
                              disabled={!canPersist}
                            >
                              mitm
                            </Button>
                          </div>
                          <div className="flex flex-wrap gap-2">
                            <Button
                              type="button"
                              size="sm"
                              variant={effectiveDraft.allowPlainProxy ? "default" : "outline"}
                              onClick={() => updateDraft((current) => ({ ...current, allowPlainProxy: !current.allowPlainProxy }))}
                              disabled={!canPersist}
                            >
                              标准代理
                            </Button>
                            <Button
                              type="button"
                              size="sm"
                              variant={effectiveDraft.allowVmessWrapper ? "default" : "outline"}
                              onClick={() => updateDraft((current) => ({ ...current, allowVmessWrapper: !current.allowVmessWrapper }))}
                              disabled={!canPersist || row.upstream_protocol !== "vmess"}
                            >
                              VMess 输出
                            </Button>
                          </div>
                          {effectiveDraft.trafficMode === trafficModeSchema.enum.mitm ? (
                            <div className="flex items-start gap-2 rounded-md border border-amber-500/40 bg-amber-500/10 p-2 text-xs text-amber-700 dark:text-amber-300">
                              <ShieldAlert className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                              <span>客户端需要先导入 CA 证书。</span>
                            </div>
                          ) : null}
                        </div>
                      </TableCell>
                      <TableCell>
                          <Input
                            type="datetime-local"
                            value={effectiveDraft.expiresAt}
                            onChange={(event) => updateDraft((current) => ({ ...current, expiresAt: event.target.value }))}
                            className="min-w-52"
                            disabled={!canPersist}
                          />
                      </TableCell>
                      <TableCell>
                        <div className="flex min-w-56 flex-col gap-2">
                          {effectiveDraft.allowPlainProxy ? (
                            normalizedProxyEndpoint ? (
                              canRenderPlain && credentials ? <>
                                <CopyUriButton label="SOCKS5" value={buildProxyUri("socks5", credentials.username, credentials.password, normalizedProxyEndpoint)} />
                                <CopyUriButton label="HTTP" value={buildProxyUri("http", credentials.username, credentials.password, normalizedProxyEndpoint)} />
                              </> : <span className="text-xs text-muted-foreground">缺少凭据，无法生成标准代理 URI</span>
                            ) : (
                              <span className="text-xs text-muted-foreground">先填写代理入口</span>
                            )
                          ) : (
                            <span className="text-xs text-muted-foreground">标准代理入口已关闭</span>
                          )}

                          {canRenderVmess ? (
                            <>
                              <OpenOutputButton label="VMess Profile" url={vmessProfileUrl} />
                              <OpenOutputButton label="VMess 订阅" url={vmessSubscriptionUrl} />
                            </>
                          ) : effectiveDraft.allowVmessWrapper ? (
                            <span className="text-xs text-muted-foreground">当前记录缺少 VMess 所需字段，无法渲染 VMess 输出</span>
                          ) : null}
                        </div>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2">
                          <Button type="button" size="sm" variant="outline" onClick={() => void handleUpdate(row)} disabled={!canPersist || updateMutation.isPending}>
                            {updateMutation.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                            保存
                          </Button>
                          <Button type="button" size="sm" variant="destructive" onClick={() => row.id ? void handleDelete(row.id) : undefined} disabled={!canPersist || deleteMutation.isPending}>
                            {deleteMutation.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Trash2 className="mr-2 h-4 w-4" />}
                            删除
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
}

function buildVmessRenderUrl(buildPath: (extractId: string) => string, extractId: string | null) {
  if (typeof window === "undefined") {
    return null;
  }

  if (!extractId) {
    return null;
  }

  return new URL(buildPath(extractId), window.location.origin).toString();
}

function OpenOutputButton({ label, url }: { label: string; url: string | null }) {
  return (
    <Button
      type="button"
      size="sm"
      variant="outline"
      disabled={!url}
      onClick={() => {
        if (!url) {
          return;
        }

        window.open(url, "_blank", "noopener,noreferrer");
      }}
    >
      <ExternalLink className="mr-2 h-4 w-4" />
      {label}
    </Button>
  );
}

function CopyUriButton({ label, value }: { label: string; value: string }) {
  const [copied, setCopied] = useState(false);

  return (
    <div className="flex items-center gap-2">
      <Badge variant="outline" className="w-16 justify-center">
        {label}
      </Badge>
      <Button
        type="button"
        size="sm"
        variant="ghost"
        className="justify-start px-0 text-xs"
        onClick={() => {
          void navigator.clipboard.writeText(value);
          setCopied(true);
          toast.success(`${label} URI 已复制`);
          window.setTimeout(() => setCopied(false), 1200);
        }}
      >
        {copied ? <Check className="mr-2 h-4 w-4" /> : <Copy className="mr-2 h-4 w-4" />}
        复制 URI
      </Button>
    </div>
  );
}
