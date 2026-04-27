"use client";

import { useQueryClient } from "@tanstack/react-query";
import { Check, Copy, Loader2, Search } from "lucide-react";
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
  mproxyRpcNames,
  mproxyNodeListSchema,
  proxyEndpointSchema,
  type ExtractCreateResult,
  type MProxyNodeRow,
} from "./schemas";

interface NodePoolCardProps {
  proxyEndpoint: string;
  onProxyEndpointChange: (value: string) => void;
}

export function NodePoolCard({ proxyEndpoint, onProxyEndpointChange }: NodePoolCardProps) {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [selectedNode, setSelectedNode] = useState<MProxyNodeRow | null>(null);
  const [displayName, setDisplayName] = useState("");
  const [expiresAt, setExpiresAt] = useState(() => defaultExpiryValue(30));
  const [latestExtract, setLatestExtract] = useState<(ExtractCreateResult & { nodeTag: string }) | null>(null);
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
    mproxyRpcNames.nodeList,
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
        throw new Error("请先选择一个节点");
      }

      const normalizedDisplayName = displayName.trim();
      if (!normalizedDisplayName) {
        throw new Error("请输入提取记录名称");
      }

      const result = await createExtractMutation.mutateAsync({
        p_node_id: selectedNode.id,
        p_display_name: normalizedDisplayName,
        p_expires_at: fromDateTimeLocalValue(expiresAt),
      });
      if (result.error) {
        throw result.error;
      }

      const parsed = extractCreateResultSchema.parse(result.data ?? []);
      const row = parsed[0];
      if (!row) {
        throw new Error("提取结果为空");
      }

      const createdExtract = { ...row, nodeTag: selectedNode.tag };
      setLatestExtract(createdExtract);
      await queryClient.invalidateQueries({ queryKey: getRpcQueryKey("mproxy_extract_list") });
      toast.success("代理已提取");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "提取代理失败");
    }
  };

  const socksUri = latestExtract && normalizedProxyEndpoint
    ? buildProxyUri("socks5", latestExtract.username, latestExtract.password, normalizedProxyEndpoint)
    : null;
  const httpUri = latestExtract && normalizedProxyEndpoint
    ? buildProxyUri("http", latestExtract.username, latestExtract.password, normalizedProxyEndpoint)
    : null;
  const nodes = nodeQuery.data ?? [];

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div className="space-y-1">
            <CardTitle>节点池</CardTitle>
            <CardDescription>通过 RPC 查看已导入节点，并为选中节点生成提取代理凭据。</CardDescription>
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
                <TableHead>节点</TableHead>
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
                    节点加载中...
                  </TableCell>
                </TableRow>
              ) : nodeQuery.isError ? (
                <TableRow>
                  <TableCell colSpan={6} className="py-8 text-center text-destructive">
                    {nodeQuery.error instanceof Error ? nodeQuery.error.message : "节点加载失败"}
                  </TableCell>
                </TableRow>
              ) : nodes.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="py-8 text-center text-muted-foreground">
                    暂无可用节点
                  </TableCell>
                </TableRow>
              ) : (
                nodes.map((node) => {
                  const isSelected = selectedNode?.id === node.id;
                  return (
                    <TableRow key={node.id} data-state={isSelected ? "selected" : undefined}>
                      <TableCell className="font-medium">{node.tag}</TableCell>
                      <TableCell>{node.protocol}</TableCell>
                      <TableCell>{node.server}:{node.server_port}</TableCell>
                      <TableCell>{node.source_name}</TableCell>
                      <TableCell>
                        <Badge variant={node.disabled ? "outline" : "secondary"}>{node.disabled ? "已禁用" : "可用"}</Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          type="button"
                          size="sm"
                          variant={isSelected ? "default" : "outline"}
                          onClick={() => {
                            setSelectedNode(node);
                            setDisplayName(node.tag);
                            setExpiresAt(defaultExpiryValue(30));
                          }}
                          disabled={node.disabled}
                        >
                          {isSelected ? "已选择" : "提取代理"}
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </div>

        <div className="grid gap-4 rounded-lg border p-4 md:grid-cols-[minmax(0,1fr)_200px_160px]">
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
              {selectedNode ? `当前节点: ${selectedNode.tag} (${selectedNode.protocol})` : "先从上方列表选择一个节点"}
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
        </div>

        {latestExtract && socksUri && httpUri ? (
          <div className="space-y-3 rounded-lg border border-dashed p-4">
            <div className="flex flex-wrap items-center gap-2">
              <Badge>最近提取</Badge>
              <span className="text-sm font-medium">{latestExtract.nodeTag}</span>
              <span className="text-xs text-muted-foreground">{latestExtract.username}</span>
            </div>
            <ProxyUriRow label="SOCKS5" value={socksUri} />
            <ProxyUriRow label="HTTP" value={httpUri} />
          </div>
        ) : latestExtract ? (
          <div className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">
            已生成提取记录。请先填写上方代理入口，再复制标准代理 URI。
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
