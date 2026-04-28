"use client";

import { useQueryClient } from "@tanstack/react-query";
import { Download, Loader2, Upload } from "lucide-react";
import { useRpcMutation } from "mtmsdk/supabase/use-sb-query/use-rpc-mutation";
import { getRpcQueryKey } from "mtmsdk/supabase/use-sb-query/use-rpc-query";
import { Badge } from "mtxuilib/ui/badge";
import { Button } from "mtxuilib/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "mtxuilib/ui/card";
import { Input } from "mtxuilib/ui/input";
import { Label } from "mtxuilib/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "mtxuilib/ui/tabs";
import { Textarea } from "mtxuilib/ui/textarea";
import { useState } from "react";
import { toast } from "sonner";
import {
  buildManualSourceUrl,
  mproxyControlPlaneHeader,
  mproxyControlPlaneHeaderValue,
  mproxyRpcNames,
  parseSubscriptionPayload,
  sourceTypeSchema,
  subscriptionFetchPath,
  subscriptionFetchResponseSchema,
  subscriptionImportResultSchema,
  type SubscriptionImportResult,
} from "./schemas";

export function SubscriptionImportCard() {
  const queryClient = useQueryClient();
  const [sourceType, setSourceType] = useState<"paste" | "url">("paste");
  const [name, setName] = useState("");
  const [remoteUrl, setRemoteUrl] = useState("");
  const [pastedJson, setPastedJson] = useState("");
  const [lastImport, setLastImport] = useState<SubscriptionImportResult | null>(null);

  const importMutation = useRpcMutation(mproxyRpcNames.subscriptionImport);

  const handleImport = async () => {
    try {
      const normalizedType = sourceTypeSchema.parse(sourceType);
      const normalizedName = name.trim();
      if (!normalizedName) {
        throw new Error("请输入订阅名称");
      }

      const payload =
        normalizedType === "paste"
          ? parseSubscriptionPayload(pastedJson)
          : parseSubscriptionPayload(await resolveRemotePayload(remoteUrl));

      const sourceUrl = normalizedType === "paste" ? buildManualSourceUrl() : remoteUrl.trim();
      const result = await importMutation.mutateAsync({
        p_name: normalizedName,
        p_source_url: sourceUrl,
        p_payload: payload,
      });

      if (result.error) {
        throw result.error;
      }

      const parsed = subscriptionImportResultSchema.parse(result.data ?? []);
      const row = parsed[0];
      if (!row) {
        throw new Error("导入结果为空");
      }

      setLastImport(row);
      await queryClient.invalidateQueries({ queryKey: getRpcQueryKey("mproxy_upstream_list") });
      toast.success(`订阅已导入，新增 ${row.inserted_count} 个上游，更新 ${row.updated_count} 个上游`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "订阅导入失败");
    }
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
          <div className="space-y-1">
            <CardTitle className="flex items-center gap-2">
              <Upload className="h-5 w-5" />
              导入订阅
            </CardTitle>
            <CardDescription>支持直接粘贴 sing-box JSON，或通过受限 helper 拉取远程 HTTPS 订阅。</CardDescription>
          </div>
          {lastImport ? (
            <Badge variant="outline" className="w-fit">
              最近导入: +{lastImport.inserted_count} / ~{lastImport.updated_count}
            </Badge>
          ) : null}
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="mproxy-source-name">订阅名称</Label>
            <Input
              id="mproxy-source-name"
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="例如：free-nodes-2026-04-27"
            />
          </div>
        </div>

        <Tabs value={sourceType} onValueChange={(value) => setSourceType(sourceTypeSchema.parse(value))}>
          <TabsList>
            <TabsTrigger value="paste">粘贴 JSON</TabsTrigger>
            <TabsTrigger value="url">远程 URL</TabsTrigger>
          </TabsList>

          <TabsContent value="paste" className="space-y-2 pt-2">
            <Label htmlFor="mproxy-pasted-json">订阅内容</Label>
            <Textarea
              id="mproxy-pasted-json"
              value={pastedJson}
              onChange={(event) => setPastedJson(event.target.value)}
              placeholder='{"outbounds": [{"type": "shadowsocks", "tag": "node-a", "server": "1.1.1.1", "server_port": 443}]}'
              className="min-h-52 font-mono text-xs"
            />
          </TabsContent>

          <TabsContent value="url" className="space-y-2 pt-2">
            <Label htmlFor="mproxy-remote-url">订阅地址</Label>
            <div className="flex flex-col gap-2 sm:flex-row">
              <Input
                id="mproxy-remote-url"
                value={remoteUrl}
                onChange={(event) => setRemoteUrl(event.target.value)}
                placeholder="https://example.com/subscription.json"
              />
              <Button
                type="button"
                variant="outline"
                onClick={() => void previewRemotePayload(remoteUrl)}
                disabled={importMutation.isPending}
              >
                <Download className="mr-2 h-4 w-4" />
                预取验证
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              远程导入仅允许 HTTPS，并会阻止 localhost、内网与 `.local` 主机名。
            </p>
          </TabsContent>
        </Tabs>

        {lastImport ? (
          <div className="rounded-lg border border-dashed p-3 text-sm text-muted-foreground">
            <div>订阅 ID: {lastImport.subscription_id}</div>
            <div>新增节点: {lastImport.inserted_count}</div>
            <div>更新节点: {lastImport.updated_count}</div>
          </div>
        ) : null}

        <div className="flex justify-end">
          <Button type="button" onClick={() => void handleImport()} disabled={importMutation.isPending}>
            {importMutation.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Upload className="mr-2 h-4 w-4" />}
            导入订阅
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

async function resolveRemotePayload(remoteUrl: string) {
  const trimmedUrl = remoteUrl.trim();
  if (!trimmedUrl) {
    throw new Error("请输入远程订阅地址");
  }

  const response = await fetch(subscriptionFetchPath, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      [mproxyControlPlaneHeader]: mproxyControlPlaneHeaderValue,
    },
    body: JSON.stringify({ url: trimmedUrl }),
    credentials: "same-origin",
    cache: "no-store",
  });
  const body = (await response.json()) as unknown;
  if (!response.ok) {
    const message = body && typeof body === "object" && "error" in body ? String(body.error) : "远程订阅拉取失败";
    throw new Error(message);
  }

  return subscriptionFetchResponseSchema.parse(body).body;
}

async function previewRemotePayload(remoteUrl: string) {
  try {
    parseSubscriptionPayload(await resolveRemotePayload(remoteUrl));
    toast.success("远程订阅可解析");
  } catch (error) {
    toast.error(error instanceof Error ? error.message : "远程订阅不可用");
  }
}
