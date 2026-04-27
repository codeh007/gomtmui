"use client";

import { useQueryClient } from "@tanstack/react-query";
import { Check, Copy, Loader2, Save, Trash2 } from "lucide-react";
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
  buildProxyUri,
  fromDateTimeLocalValue,
  mproxyExtractListSchema,
  mproxyExtractUpdateSchema,
  mproxyRpcNames,
  proxyEndpointSchema,
  toDateTimeLocalValue,
  type MProxyExtractRow,
} from "./schemas";

type ExtractDraftMap = Record<string, { expiresAt: string; disabled: boolean }>;

interface ExtractRecordsCardProps {
  proxyEndpoint: string;
  onProxyEndpointChange: (value: string) => void;
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
        next[row.id] = previous[row.id] ?? {
          expiresAt: toDateTimeLocalValue(row.expires_at),
          disabled: row.disabled,
        };
      }
      return next;
    });
  }, [extracts]);

  const updateMutation = useRpcMutation(mproxyRpcNames.extractUpdate);
  const deleteMutation = useRpcMutation(mproxyRpcNames.extractDelete);

  const handleUpdate = async (row: MProxyExtractRow) => {
    try {
      const draft = drafts[row.id];
      if (!draft) {
        throw new Error("找不到待保存的草稿状态");
      }

      const result = await updateMutation.mutateAsync({
        p_id: row.id,
        p_expires_at: fromDateTimeLocalValue(draft.expiresAt),
        p_disabled: draft.disabled,
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
        <CardDescription>通过 RPC 列出、更新和删除提取代理记录，并复制标准代理 URI。</CardDescription>
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
            <p className="text-xs text-muted-foreground">URI 复制使用这里显式配置的 mproxy 入口，而不是当前 gomtmui 站点域名。</p>
          </div>
        </div>

        <div className="overflow-x-auto rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>名称</TableHead>
                <TableHead>节点</TableHead>
                <TableHead>账号</TableHead>
                <TableHead>状态</TableHead>
                <TableHead>过期时间</TableHead>
                <TableHead>URI</TableHead>
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
                  const draft = drafts[row.id] ?? {
                    expiresAt: toDateTimeLocalValue(row.expires_at),
                    disabled: row.disabled,
                  };
                  return (
                    <TableRow key={row.id}>
                      <TableCell>
                        <div className="font-medium">{row.display_name}</div>
                        <div className="text-xs text-muted-foreground">{row.id}</div>
                      </TableCell>
                      <TableCell>
                        <div>{row.node_tag}</div>
                        <div className="text-xs text-muted-foreground">{row.node_protocol}</div>
                      </TableCell>
                      <TableCell>
                        <div className="font-mono text-xs">{row.username}</div>
                        <div className="font-mono text-xs text-muted-foreground">{row.password}</div>
                      </TableCell>
                      <TableCell>
                        <Button
                          type="button"
                          variant={draft.disabled ? "outline" : "secondary"}
                          size="sm"
                          onClick={() =>
                            setDrafts((previous) => ({
                              ...previous,
                              [row.id]: { ...draft, disabled: !draft.disabled },
                            }))
                          }
                        >
                          {draft.disabled ? "已禁用" : "启用中"}
                        </Button>
                      </TableCell>
                      <TableCell>
                        <Input
                          type="datetime-local"
                          value={draft.expiresAt}
                          onChange={(event) =>
                            setDrafts((previous) => ({
                              ...previous,
                              [row.id]: { ...draft, expiresAt: event.target.value },
                            }))
                          }
                          className="min-w-52"
                        />
                      </TableCell>
                      <TableCell>
                        {normalizedProxyEndpoint ? (
                          <div className="flex flex-col gap-2">
                            <CopyUriButton
                              label="SOCKS5"
                              value={buildProxyUri("socks5", row.username, row.password, normalizedProxyEndpoint)}
                            />
                            <CopyUriButton
                              label="HTTP"
                              value={buildProxyUri("http", row.username, row.password, normalizedProxyEndpoint)}
                            />
                          </div>
                        ) : (
                          <span className="text-xs text-muted-foreground">先填写代理入口</span>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2">
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            onClick={() => void handleUpdate(row)}
                            disabled={updateMutation.isPending}
                          >
                            {updateMutation.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                            保存
                          </Button>
                          <Button
                            type="button"
                            size="sm"
                            variant="destructive"
                            onClick={() => void handleDelete(row.id)}
                            disabled={deleteMutation.isPending}
                          >
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
