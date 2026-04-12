"use client";

import { MoreHorizontal, Trash } from "lucide-react";
import { useRpcMutation } from "mtmsdk/supabase/use-sb-query/use-rpc-mutation";
import { useRpcQuery } from "mtmsdk/supabase/use-sb-query/use-rpc-query";
import { publicGomtmModelsRowSchema } from "mtmsdk/types/database.schemas";
import { useToast } from "mtxuilib/hooks/useToast";
import { Badge } from "mtxuilib/ui/badge";
import { Button } from "mtxuilib/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "mtxuilib/ui/card";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "mtxuilib/ui/dropdown-menu";
import { Input } from "mtxuilib/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "mtxuilib/ui/table";
import { useMemo, useState } from "react";
import { z } from "zod";
import { useDebounce } from "@/hooks/use-debounce";

interface Model {
  id: string;
  name: string;
  provider: string;
  model: string;
  api_base: string | null;
  linked_account_id: string | null;
  is_active: boolean;
  created_at: string;
}

export const ModelList = () => {
  const { toast } = useToast();

  const [searchTerm, setSearchTerm] = useState("");
  const debouncedSearchTerm = useDebounce(searchTerm, 500);

  const {
    data: rawData,
    isLoading,
    error,
    refetch,
  } = useRpcQuery(
    "gomtm_model_list_cursor",
    { p_limit: 100 },
    {
      schema: z.array(publicGomtmModelsRowSchema),
      staleTime: 30000,
      refetchOnWindowFocus: false,
    },
  );

  const deleteMutation = useRpcMutation("gomtm_model_delete", {
    onSuccess: (result) => {
      if (result.error) {
        toast({ variant: "destructive", title: "删除失败", description: result.error.message });
        return;
      }
      toast({ title: "删除成功", description: "模型配置已成功删除。" });
      void refetch();
    },
    onError: (error) => {
      toast({ variant: "destructive", title: "删除失败", description: error.message });
    },
  });

  const updateMutation = useRpcMutation("gomtm_model_upsert", {
    onSuccess: (result) => {
      if (result.error) {
        toast({ variant: "destructive", title: "更新失败", description: result.error.message });
        return;
      }
      toast({ title: "状态更新成功" });
      void refetch();
    },
    onError: (error) => {
      toast({ variant: "destructive", title: "状态更新失败", description: error.message });
    },
  });

  const data = useMemo(() => {
    if (!rawData) return [];
    if (!debouncedSearchTerm) return rawData;
    const kw = debouncedSearchTerm.toLowerCase();
    return rawData.filter(
      (item) =>
        item.name?.toLowerCase().includes(kw) ||
        item.provider?.toLowerCase().includes(kw) ||
        item.model?.toLowerCase().includes(kw),
    );
  }, [rawData, debouncedSearchTerm]);

  const handleDelete = async (id: string) => {
    if (!window.confirm("确定要删除这个模型配置吗？")) {
      return;
    }
    deleteMutation.mutate({ p_id: id });
  };

  const toggleActiveStatus = async (model: Model) => {
    updateMutation.mutate({
      p_id: model.id,
      p_name: model.name,
      p_provider: model.provider,
      p_model: model.model,
      p_api_base: model.api_base ?? "",
      p_api_key: "",
      p_linked_account_id: model.linked_account_id ?? "",
      p_is_active: !model.is_active,
      p_config: {},
    });
  };

  return (
    <Card>
      <CardHeader className="px-6 py-4">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <CardTitle>AI 模型配置</CardTitle>
          <div className="flex w-full sm:w-auto gap-2">
            <Input
              placeholder="搜索模型..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="max-w-sm"
            />
          </div>
        </div>
      </CardHeader>
      <CardContent className="px-6 py-4">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>名称</TableHead>
              <TableHead>提供商</TableHead>
              <TableHead>模型</TableHead>
              <TableHead>API Base</TableHead>
              <TableHead>状态</TableHead>
              <TableHead>创建时间</TableHead>
              <TableHead className="text-right">操作</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center py-8">
                  加载中...
                </TableCell>
              </TableRow>
            ) : error ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center py-8 text-destructive">
                  加载失败: {(error as any).message}
                </TableCell>
              </TableRow>
            ) : !data || data.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center py-8">
                  暂无模型配置
                </TableCell>
              </TableRow>
            ) : (
              data.map((model) => (
                <TableRow key={model.id}>
                  <TableCell className="font-medium">{model.name}</TableCell>
                  <TableCell>
                    <Badge variant="secondary">{model.provider}</Badge>
                  </TableCell>
                  <TableCell>{model.model}</TableCell>
                  <TableCell>
                    {model.api_base ? (
                      <span className="text-xs text-muted-foreground truncate max-w-[150px] inline-block">
                        {model.api_base}
                      </span>
                    ) : (
                      <span className="text-xs text-muted-foreground">-</span>
                    )}
                  </TableCell>
                  <TableCell>
                    <Badge variant={model.is_active ? "default" : "outline"}>{model.is_active ? "启用" : "停用"}</Badge>
                  </TableCell>
                  <TableCell>{new Date(model.created_at).toLocaleDateString()}</TableCell>
                  <TableCell className="text-right">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" className="h-8 w-8 p-0">
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => toggleActiveStatus(model as Model)}>
                          {model.is_active ? "停用" : "启用"}
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onClick={() => handleDelete(model.id)}
                          className="text-destructive focus:text-destructive"
                        >
                          <Trash className="mr-2 h-4 w-4" />
                          删除
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
};
