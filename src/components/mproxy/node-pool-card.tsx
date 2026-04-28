"use client";

import { useQueryClient } from "@tanstack/react-query";
import { Check, Copy, Loader2, Search, ShieldAlert } from "lucide-react";
import { useRpcMutation } from "mtmsdk/supabase/use-sb-query/use-rpc-mutation";
import { getRpcQueryKey, useRpcQuery } from "mtmsdk/supabase/use-sb-query/use-rpc-query";
import { Badge } from "mtxuilib/ui/badge";
import { Button } from "mtxuilib/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "mtxuilib/ui/card";
import { Input } from "mtxuilib/ui/input";
import { Label } from "mtxuilib/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "mtxuilib/ui/table";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import {
  buildProxyUri,
  defaultExpiryValue,
  extractCreateResultSchema,
  fromDateTimeLocalValue,
  mproxyNodeListSchema,
  mproxyRpcNames,
  proxyEndpointSchema,
  trafficModeSchema,
  type ExtractCreateResult,
  type MProxyNodeRow,
  type MProxyTrafficMode,
} from "./schemas";

interface NodePoolCardProps {
  proxyEndpoint: string;
  onProxyEndpointChange: (value: string) => void;
}

function getUpstreamLabel(node: MProxyNodeRow) {
  const tag = node.tag?.trim();
  if (tag) {
    return tag;
  }

  const sourceName = node.source_name?.trim();
  if (sourceName) {
    return sourceName;
  }

  return node.is_direct ? "直连上游" : "未命名上游";
}

function getUpstreamEndpoint(node: MProxyNodeRow) {
  if (node.server && typeof node.server_port === "number") {
    return `${node.server}:${node.server_port}`;
  }

  return "数据缺失";
}

export function NodePoolCard({ proxyEndpoint, onProxyEndpointChange }: NodePoolCardProps) {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [selectedNode, setSelectedNode] = useState<MProxyNodeRow | null>(null);
  const [displayName, setDisplayName] = useState("");
  const [expiresAt, setExpiresAt] = useState(() => defaultExpiryValue(30));
  const [trafficMode, setTrafficMode] = useState<MProxyTrafficMode>(trafficModeSchema.enum.standard);
  const [allowPlainProxy, setAllowPlainProxy] = useState(true);
  const [allowVmessWrapper, setAllowVmessWrapper] = useState(false);
  const [latestExtract, setLatestExtract] = useState<(ExtractCreateResult & { upstreamProtocol: string; upstreamTag: string }) | null>(null);

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

  const nodeQuery = useRpcQuery(
    mproxyRpcNames.upstreamList,
    { p_kw: search.trim() || null },
    {
      queryKeySuffix: [search.trim()],
      schema: mproxyNodeListSchema,
    },
  );

  const createExtractMutation = useRpcMutation(mproxyRpcNames.extractCreate);

  const handleCreateExtract = async () => {
    try {
      if (!selectedNode) {
        throw new Error("请先选择一个上游");
      }

      if (!selectedNode.id) {
        throw new Error("当前上游缺少 ID，无法创建提取记录");
      }

      const normalizedDisplayName = displayName.trim();
      if (!normalizedDisplayName) {
        throw new Error("请输入提取记录名称");
      }

      if (!allowPlainProxy && !allowVmessWrapper) {
        throw new Error("至少启用一个入口策略");
      }

      if (allowVmessWrapper && selectedNode.protocol !== "vmess") {
        throw new Error("只有 VMess 上游可以启用 VMess 输出");
      }

      const result = await createExtractMutation.mutateAsync({
        p_allow_plain_proxy: allowPlainProxy,
        p_allow_vmess_wrapper: allowVmessWrapper,
        p_display_name: normalizedDisplayName,
        p_expires_at: fromDateTimeLocalValue(expiresAt),
        p_traffic_mode: trafficMode,
        p_upstream_id: selectedNode.id,
      });
      if (result.error) {
        throw result.error;
      }

      const parsed = extractCreateResultSchema.parse(result.data ?? []);
      const row = parsed[0];
      if (!row) {
        throw new Error("提取结果为空");
      }

      setLatestExtract({
        ...row,
        upstreamProtocol: selectedNode.protocol ?? "",
        upstreamTag: getUpstreamLabel(selectedNode),
      });
      await queryClient.invalidateQueries({ queryKey: getRpcQueryKey("mproxy_extract_list") });
      toast.success("代理已提取");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "提取代理失败");
    }
  };

  const socksUri = latestExtract?.allow_plain_proxy && normalizedProxyEndpoint
    ? buildProxyUri("socks5", latestExtract.username, latestExtract.password, normalizedProxyEndpoint)
    : null;
  const httpUri = latestExtract?.allow_plain_proxy && normalizedProxyEndpoint
    ? buildProxyUri("http", latestExtract.username, latestExtract.password, normalizedProxyEndpoint)
    : null;
  const nodes = nodeQuery.data ?? [];

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div className="space-y-1">
            <CardTitle>上游池</CardTitle>
            <CardDescription>通过 RPC 查看已导入或手动创建的上游，并为选中上游生成提取代理凭据。</CardDescription>
          </div>
          <div className="relative w-full sm:w-72">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="搜索 tag 或来源" className="pl-9" />
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-2 rounded-lg border border-dashed p-4 md:grid-cols-[180px_minmax(0,1fr)] md:items-center">
          <Label htmlFor="mproxy-proxy-endpoint">代理入口</Label>
          <div className="space-y-2">
            <Input
              id="mproxy-proxy-endpoint"
              value={proxyEndpoint}
              onChange={(event) => onProxyEndpointChange(event.target.value)}
              placeholder="例如：proxy.example.com:10085"
            />
            <p className="text-xs text-muted-foreground">显式填写实际 gomtm mproxy mixed 入口地址，UI 不再默认使用 gomtmui 站点主机名。</p>
          </div>
        </div>

        <div className="overflow-x-auto rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>上游</TableHead>
                <TableHead>协议</TableHead>
                <TableHead>出口</TableHead>
                <TableHead>来源</TableHead>
                <TableHead>状态</TableHead>
                <TableHead className="text-right">操作</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {nodeQuery.isLoading ? (
                <TableRow>
                  <TableCell colSpan={6} className="py-8 text-center text-muted-foreground">
                    上游加载中...
                  </TableCell>
                </TableRow>
              ) : nodeQuery.isError ? (
                <TableRow>
                  <TableCell colSpan={6} className="py-8 text-center text-destructive">
                    {nodeQuery.error instanceof Error ? nodeQuery.error.message : "上游加载失败"}
                  </TableCell>
                </TableRow>
              ) : nodes.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="py-8 text-center text-muted-foreground">
                    暂无可用上游
                  </TableCell>
                </TableRow>
              ) : (
                nodes.map((node) => {
                  const isSelected = selectedNode?.id === node.id;
                  const nodeLabel = getUpstreamLabel(node);
                  const canSelect = Boolean(node.id) && node.disabled === false;
                  return (
                    <TableRow key={node.id ?? `${node.tag ?? "upstream"}-${node.source_name ?? "unknown"}`} data-state={isSelected ? "selected" : undefined}>
                      <TableCell>
                        <div className="flex items-center gap-2 font-medium">
                          <span>{nodeLabel}</span>
                          {node.is_direct ? <Badge variant="outline">直连</Badge> : null}
                        </div>
                      </TableCell>
                      <TableCell>{node.protocol ?? "-"}</TableCell>
                      <TableCell>{getUpstreamEndpoint(node)}</TableCell>
                      <TableCell>
                        <div>{node.source_name ?? "手动创建"}</div>
                        <div className="text-xs text-muted-foreground">{node.source_url ?? "direct upstream"}</div>
                      </TableCell>
                      <TableCell>
                        <Badge variant={node.disabled === false ? "secondary" : "outline"}>{node.disabled === false ? "可用" : "不可提取"}</Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          type="button"
                          size="sm"
                          variant={isSelected ? "default" : "outline"}
                          onClick={() => {
                            setSelectedNode(node);
                            setDisplayName(nodeLabel);
                            setExpiresAt(defaultExpiryValue(30));
                            setTrafficMode(trafficModeSchema.enum.standard);
                            setAllowPlainProxy(true);
                            setAllowVmessWrapper(node.protocol === "vmess");
                          }}
                          disabled={!canSelect}
                        >
                          {!node.id ? "缺少 ID" : isSelected ? "已选择" : "提取代理"}
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </div>

        <div className="grid gap-4 rounded-lg border p-4 lg:grid-cols-[minmax(0,1fr)_220px_180px]">
          <div className="space-y-2">
            <Label htmlFor="mproxy-extract-display-name">提取名称</Label>
            <Input
              id="mproxy-extract-display-name"
              value={displayName}
              onChange={(event) => setDisplayName(event.target.value)}
              placeholder="例如：东京节点 A"
              disabled={!selectedNode}
            />
            <p className="text-xs text-muted-foreground">
              {selectedNode ? `当前上游: ${getUpstreamLabel(selectedNode)}${selectedNode.protocol ? ` (${selectedNode.protocol})` : ""}` : "先从上方列表选择一个上游"}
            </p>
          </div>
          <div className="space-y-2">
            <Label htmlFor="mproxy-extract-expires-at">过期时间</Label>
            <Input
              id="mproxy-extract-expires-at"
              type="datetime-local"
              value={expiresAt}
              onChange={(event) => setExpiresAt(event.target.value)}
              disabled={!selectedNode}
            />
          </div>
          <div className="flex items-end justify-end">
            <Button type="button" onClick={() => void handleCreateExtract()} disabled={!selectedNode || createExtractMutation.isPending}>
              {createExtractMutation.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              创建提取记录
            </Button>
          </div>

          <div className="space-y-2 lg:col-span-2">
            <Label>运行模式</Label>
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                size="sm"
                variant={trafficMode === trafficModeSchema.enum.standard ? "default" : "outline"}
                onClick={() => setTrafficMode(trafficModeSchema.enum.standard)}
                disabled={!selectedNode}
              >
                standard
              </Button>
              <Button
                type="button"
                size="sm"
                variant={trafficMode === trafficModeSchema.enum.mitm ? "default" : "outline"}
                onClick={() => setTrafficMode(trafficModeSchema.enum.mitm)}
                disabled={!selectedNode}
              >
                mitm
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">`standard` 直接转发上游流量，`mitm` 需要客户端安装 CA 证书后才能稳定处理 HTTPS。</p>
          </div>

          <div className="space-y-2">
            <Label>入口策略</Label>
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                size="sm"
                variant={allowPlainProxy ? "default" : "outline"}
                onClick={() => setAllowPlainProxy((current) => !current)}
                disabled={!selectedNode}
              >
                标准代理
              </Button>
              <Button
                type="button"
                size="sm"
                variant={allowVmessWrapper ? "default" : "outline"}
                onClick={() => setAllowVmessWrapper((current) => !current)}
                disabled={!selectedNode || selectedNode.protocol !== "vmess"}
              >
                VMess 输出
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              {selectedNode?.protocol === "vmess" ? "VMess 输出会暴露 profile/subscription 渲染入口。" : "只有 VMess 上游可以启用 VMess 输出。"}
            </p>
          </div>
        </div>

        {trafficMode === trafficModeSchema.enum.mitm ? (
          <div className="rounded-lg border border-amber-500/40 bg-amber-500/10 p-4 text-sm text-amber-700 dark:text-amber-300">
            <div className="flex items-start gap-2">
              <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0" />
              <div>
                <div className="font-medium">MITM 模式需要 CA 证书</div>
                <p className="mt-1 text-xs text-current/90">创建后请在客户端导入 mproxy CA，否则 HTTPS 请求会出现证书错误。</p>
              </div>
            </div>
          </div>
        ) : null}

        {latestExtract && socksUri && httpUri ? (
          <div className="space-y-3 rounded-lg border border-dashed p-4">
            <div className="flex flex-wrap items-center gap-2">
              <Badge>最近提取</Badge>
              <span className="text-sm font-medium">{latestExtract.upstreamTag}</span>
              <span className="text-xs text-muted-foreground">{latestExtract.username}</span>
              <Badge variant="outline">{latestExtract.traffic_mode}</Badge>
              {latestExtract.allow_plain_proxy ? <Badge variant="secondary">标准代理</Badge> : null}
              {latestExtract.allow_vmess_wrapper ? <Badge variant="secondary">VMess 输出</Badge> : null}
            </div>
            <ProxyUriRow label="SOCKS5" value={socksUri} />
            <ProxyUriRow label="HTTP" value={httpUri} />
            {latestExtract.traffic_mode === trafficModeSchema.enum.mitm ? (
              <p className="text-xs text-amber-700 dark:text-amber-300">当前记录处于 MITM 模式，使用前请先在客户端导入 CA 证书。</p>
            ) : null}
            {latestExtract.allow_vmess_wrapper && latestExtract.upstreamProtocol === "vmess" ? (
              <p className="text-xs text-muted-foreground">VMess profile/subscription 渲染入口已启用，可在下方提取记录中查看。</p>
            ) : null}
          </div>
        ) : latestExtract ? (
          <div className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">
            已生成提取记录。
            {latestExtract.allow_plain_proxy ? " 请先填写上方代理入口，再复制标准代理 URI。" : " 当前记录未启用标准代理入口。"}
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}

function ProxyUriRow({ label, value }: { label: string; value: string }) {
  const [copied, setCopied] = useState(false);

  return (
    <div className="flex flex-col gap-2 md:flex-row md:items-center">
      <div className="w-20 text-sm font-medium">{label}</div>
      <code className="flex-1 break-all rounded bg-muted px-3 py-2 text-xs">{value}</code>
      <Button
        type="button"
        variant="outline"
        size="sm"
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
