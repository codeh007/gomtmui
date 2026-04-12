"use client";

import { useQueryClient } from "@tanstack/react-query";
import { Loader2, Trash2 } from "lucide-react";
import { useRpcMutation } from "mtmsdk/supabase/use-sb-query/use-rpc-mutation";
import { getRpcQueryKey } from "mtmsdk/supabase/use-sb-query/use-rpc-query";
import type { ServerInstanceGetReturns } from "mtmsdk/types/contracts";
import { Button } from "mtxuilib/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "mtxuilib/ui/card";
import { Input } from "mtxuilib/ui/input";
import { Label } from "mtxuilib/ui/label";
import { useEffect, useState } from "react";
import { toast } from "sonner";

export function TrafficDbConfigForm({ resource }: { resource: ServerInstanceGetReturns | null }) {
  const [url, setUrl] = useState("");
  const [key, setKey] = useState("");
  const queryClient = useQueryClient();
  const updateMutation = useRpcMutation("server_upsert", {
    onSuccess: (result) => {
      if (result.error) {
        toast.error(`创建失败: ${result.error.message}`);
        return;
      }
      toast.success("配置已保存");
      void queryClient.invalidateQueries({ queryKey: getRpcQueryKey("server_list_cursor") });
      void queryClient.invalidateQueries({ queryKey: getRpcQueryKey("server_get") });
    },
    onError: (error) => {
      toast.error(`保存失败: ${error.message}`);
    },
  });

  useEffect(() => {
    // 从 state 字段读取配置 (state 是 jsonb 类型)
    if (resource?.state) {
      const state = resource.state as Record<string, unknown>;
      if (state.sidecar_db_url) setUrl(state.sidecar_db_url as string);
      if (state.sidecar_db_key) setKey(state.sidecar_db_key as string);
    }
  }, [resource]);

  const handleSave = async () => {
    if (!url || !key) {
      toast.error("请填写 URL 和 Key");
      return;
    }
    await updateState({
      sidecar_db_url: url,
      sidecar_db_key: key,
    });
  };

  const handleClear = async () => {
    if (confirm("确定要移除外部数据库配置吗？系统将切回内部存储模式。")) {
      await updateState({
        sidecar_db_url: null,
        sidecar_db_key: null,
      });
    }
  };

  const updateState = async (updates: Record<string, unknown>) => {
    try {
      if (!resource?.id) throw new Error("未找到资源 ID");

      // 合并到现有的 state 中
      const currentState = (resource.state as Record<string, unknown>) || {};
      const newState = { ...currentState, ...updates };

      await updateMutation.mutateAsync({
        p_id: resource.id,
        p_state: newState as unknown as import("mtmsdk/types/database.types").Json,
      });
    } catch (e: unknown) {
      console.error(e);
      // toast is already handled by mutation onError, but we can add more if needed.
    }
  };

  const loading = updateMutation.isPending;

  return (
    <Card className="w-full shadow-md bg-white border-0">
      <CardHeader>
        <CardTitle>配置流量数据库</CardTitle>
        <CardDescription>
          默认情况下，流量存储在内部 SQLite（临时）。连接 Sidecar 数据库（Supabase）可以实现持久化、大容量的日志记录。
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label>Sidecar 数据库 URL</Label>
          <Input value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://your-project.supabase.co" />
        </div>
        <div className="space-y-2">
          <Label>Sidecar 数据库 Key (Service Role)</Label>
          <Input
            value={key}
            onChange={(e) => setKey(e.target.value)}
            type="password"
            placeholder="eyJhbGciOiJIUzI1NiIsInR5cCI..."
          />
        </div>
      </CardContent>
      <CardFooter className="justify-between">
        <Button
          variant="ghost"
          size="sm"
          className="text-red-600 hover:text-red-700 hover:bg-red-50"
          onClick={handleClear}
          disabled={loading || !url}
        >
          <Trash2 className="w-4 h-4 mr-2" /> 重置为内部存储
        </Button>
        <Button onClick={handleSave} disabled={loading}>
          {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          保存配置
        </Button>
      </CardFooter>
    </Card>
  );
}
