"use client";

import { useQueryClient } from "@tanstack/react-query";
import { Edit2, Loader2, SlidersHorizontal } from "lucide-react";
import { useRpcMutation } from "mtmsdk/supabase/use-sb-query/use-rpc-mutation";
import { getRpcQueryKey, useRpcQuery } from "mtmsdk/supabase/use-sb-query/use-rpc-query";
import type { Json } from "mtmsdk/types/database.types";
import { Badge } from "mtxuilib/ui/badge";
import { Button } from "mtxuilib/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "mtxuilib/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "mtxuilib/ui/dialog";
import { Label } from "mtxuilib/ui/label";
import { Skeleton } from "mtxuilib/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "mtxuilib/ui/table";
import { Textarea } from "mtxuilib/ui/textarea";
import { useState } from "react";
import { toast } from "sonner";
import { z } from "zod";

// Schema for list item returned by system_config_public_list
const ConfigItemSchema = z.object({
  key: z.string(),
  value: z.any(), // jsonb
  description: z.string().nullable(),
  updated_at: z.string().nullable(),
});

type ConfigItem = z.infer<typeof ConfigItemSchema>;

export function GenericConfigList() {
  const queryClient = useQueryClient();
  const [editingItem, setEditingItem] = useState<ConfigItem | null>(null);

  // Fetch all public configs
  const { data: configs, isLoading } = useRpcQuery(
    "system_config_public_list",
    {},
    { schema: z.array(ConfigItemSchema) },
  );

  return (
    <Card className="w-full border-slate-200 dark:border-slate-800 shadow-sm">
      <CardHeader className="pb-4">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-slate-600 rounded-lg text-white">
            <SlidersHorizontal className="h-5 w-5" />
          </div>
          <div className="flex-1">
            <CardTitle className="text-lg font-semibold">通用配置列表</CardTitle>
            <CardDescription className="text-sm mt-0.5">
              查看和编辑所有公开的系统配置项 (System Config Public)
            </CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="rounded-md border overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[200px]">配置键 (Key)</TableHead>
                  <TableHead>描述</TableHead>
                  <TableHead className="w-[300px]">当前值 (JSON Preview)</TableHead>
                  <TableHead className="w-[150px]">最后更新</TableHead>
                  <TableHead className="w-[100px] text-right">操作</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {[0, 1, 2].map((row) => (
                  <TableRow key={row}>
                    <TableCell>
                      <Skeleton className="h-4 w-28" />
                    </TableCell>
                    <TableCell>
                      <Skeleton className="h-4 w-40" />
                    </TableCell>
                    <TableCell>
                      <Skeleton className="h-4 w-64" />
                    </TableCell>
                    <TableCell>
                      <Skeleton className="h-4 w-24" />
                    </TableCell>
                    <TableCell className="text-right">
                      <Skeleton className="h-7 w-7 ml-auto" />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        ) : !configs?.length ? (
          <div className="text-center text-muted-foreground py-8 text-sm">暂无配置项</div>
        ) : (
          <div className="rounded-md border overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[200px]">配置键 (Key)</TableHead>
                  <TableHead>描述</TableHead>
                  <TableHead className="w-[300px]">当前值 (JSON Preview)</TableHead>
                  <TableHead className="w-[150px]">最后更新</TableHead>
                  <TableHead className="w-[100px] text-right">操作</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {configs.map((item) => (
                  <TableRow key={item.key}>
                    <TableCell className="font-mono text-sm font-medium">
                      {item.key}
                      {item.key === "domain_config" && (
                        <Badge variant="secondary" className="ml-2 text-[10px]">
                          Built-in
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-muted-foreground text-sm">{item.description || "-"}</TableCell>
                    <TableCell>
                      <code className="text-xs bg-muted px-1 py-0.5 rounded block truncate max-w-[280px]">
                        {JSON.stringify(item.value)}
                      </code>
                    </TableCell>
                    <TableCell className="text-muted-foreground text-xs">
                      {item.updated_at ? new Date(item.updated_at).toLocaleString() : "-"}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button variant="ghost" size="sm" onClick={() => setEditingItem(item)}>
                        <Edit2 className="h-3.5 w-3.5" />
                        <span className="sr-only">编辑</span>
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>

      {editingItem && (
        <EditConfigDialog
          key={editingItem.key}
          item={editingItem}
          open={!!editingItem}
          onOpenChange={(open) => !open && setEditingItem(null)}
          onSuccess={() => {
            queryClient.invalidateQueries({
              queryKey: getRpcQueryKey("system_config_public_list"),
            });
            if (editingItem.key === "domain_config") {
              queryClient.invalidateQueries({
                queryKey: getRpcQueryKey("system_config_public_get"),
              });
            }
            setEditingItem(null);
          }}
        />
      )}
    </Card>
  );
}

function EditConfigDialog({
  open,
  item,
  onOpenChange,
  onSuccess,
}: {
  open: boolean;
  item: ConfigItem;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}) {
  const updateMutation = useRpcMutation("system_config_public_set");
  const [value, setValue] = useState(JSON.stringify(item.value, null, 2));
  const [error, setError] = useState<string | null>(null);

  const handleSave = async () => {
    setError(null);
    try {
      let parsed: any;
      try {
        parsed = JSON.parse(value);
      } catch (e: any) {
        throw new Error(`JSON 格式错误: ${e.message}`);
      }

      const { error: apiError } = await updateMutation.mutateAsync({
        p_key: item.key,
        p_value: parsed as Json,
      });

      if (apiError) throw apiError;

      toast.success("配置已更新");
      onSuccess();
    } catch (err: any) {
      setError(err.message || "更新失败");
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px]">
        <DialogHeader>
          <DialogTitle>编辑配置: {item.key}</DialogTitle>
          <DialogDescription>{item.description || "修改配置项的 JSON 值。请确保格式正确。"}</DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 py-4">
          <div className="grid gap-2">
            <Label htmlFor="json-value">JSON Value</Label>
            <Textarea
              id="json-value"
              className="font-mono text-sm min-h-[300px]"
              value={value}
              onChange={(e) => setValue(e.target.value)}
            />
            {error && <div className="text-sm text-destructive bg-destructive/10 p-2 rounded">{error}</div>}
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={updateMutation.isPending}>
            取消
          </Button>
          <Button onClick={handleSave} disabled={updateMutation.isPending}>
            {updateMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            保存修改
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
