"use client";

import { useRpcMutation } from "mtmsdk/supabase/use-sb-query/use-rpc-mutation";
import { useRpcQuery } from "mtmsdk/supabase/use-sb-query/use-rpc-query";
import { randomUUID } from "mtxuilib/lib/utils";
import { Button } from "mtxuilib/ui/button";
import { Input } from "mtxuilib/ui/input";
import { Label } from "mtxuilib/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "mtxuilib/ui/select";
import { Switch } from "mtxuilib/ui/switch";
import { toast } from "mtxuilib/ui/use-toast";
import { useState } from "react";
import { z } from "zod";
import { CloudAccountRecordSchema } from "@/components/cloud-account/schemas";

interface AddModelViewProps {
  onSuccess?: () => void;
  onCancel?: () => void;
}

export const AddModelView = ({ onSuccess, onCancel }: AddModelViewProps) => {
  const [formData, setFormData] = useState({
    name: "",
    provider: "",
    model: "",
    api_base: "",
    api_key: "",
    linked_account_id: "",
    is_active: true,
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);
  const { data: linkedAccounts, isLoading: accountsLoading } = useRpcQuery(
    "cloud_account_list_cursor",
    { p_limit: 100 },
    {
      refetchOnWindowFocus: false,
      staleTime: 30000,
      schema: z.array(CloudAccountRecordSchema),
    },
  );

  const handleChange = (name: string, value: string | boolean) => {
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
    if (errors[name]) {
      setErrors((prev) => {
        const newErrors = { ...prev };
        delete newErrors[name];
        return newErrors;
      });
    }
  };

  const validateForm = () => {
    const newErrors: Record<string, string> = {};

    if (!formData.name.trim()) {
      newErrors.name = "请输入模型配置名称";
    }

    if (!formData.provider) {
      newErrors.provider = "请选择提供商";
    }

    if (!formData.model.trim()) {
      newErrors.model = "请输入模型名称";
    }

    if (!formData.linked_account_id && !formData.api_key.trim()) {
      newErrors.api_key = "请提供API密钥或关联账户";
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const saveMutation = useRpcMutation("gomtm_model_upsert", {
    onSuccess: (result) => {
      if (result.error) {
        toast({ variant: "destructive", title: "保存失败", description: result.error.message });
        return;
      }
      toast({ title: "保存成功", description: "模型配置已成功保存。" });
      onSuccess?.();
    },
    onError: (error) => {
      toast({ variant: "destructive", title: "保存失败", description: error.message });
    },
  });

  const handleSubmit = () => {
    if (!validateForm()) {
      return;
    }
    saveMutation.mutate(
      {
        p_id: randomUUID(),
        p_name: formData.name,
        p_provider: formData.provider,
        p_model: formData.model,
        p_api_base: formData.api_base || "",
        p_api_key: formData.api_key || "",
        p_linked_account_id: formData.linked_account_id || "",
        p_is_active: formData.is_active,
        p_config: {},
      },
      {
        onSettled: () => setLoading(false),
      },
    );
  };

  return (
    <div className="flex flex-col h-full">
      <div className="grid gap-4 py-4 px-6 flex-1 overflow-y-auto">
        <div className="grid grid-cols-4 items-center gap-4">
          <Label htmlFor="name" className="text-right whitespace-nowrap">
            名称 *
          </Label>
          <Input
            id="name"
            className={`col-span-3 ${errors.name ? "border-red-500" : ""}`}
            value={formData.name}
            onChange={(e) => handleChange("name", e.target.value)}
            placeholder="例如：我的OpenAI配置"
          />
          {errors.name && <div className="col-span-3 col-start-2 text-red-500 text-sm">{errors.name}</div>}
        </div>

        <div className="grid grid-cols-4 items-center gap-4">
          <Label htmlFor="provider" className="text-right whitespace-nowrap">
            提供商 *
          </Label>
          <Select value={formData.provider} onValueChange={(value) => handleChange("provider", value)}>
            <SelectTrigger className={`col-span-3 ${errors.provider ? "border-red-500" : ""}`}>
              <SelectValue placeholder="选择提供商" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="openai">OpenAI</SelectItem>
              <SelectItem value="anthropic">Anthropic</SelectItem>
              <SelectItem value="qwen">通义千问</SelectItem>
              <SelectItem value="google">Google</SelectItem>
              <SelectItem value="azure">Azure OpenAI</SelectItem>
            </SelectContent>
          </Select>
          {errors.provider && <div className="col-span-3 col-start-2 text-red-500 text-sm">{errors.provider}</div>}
        </div>

        <div className="grid grid-cols-4 items-center gap-4">
          <Label htmlFor="model" className="text-right whitespace-nowrap">
            模型 *
          </Label>
          <Input
            id="model"
            className={`col-span-3 ${errors.model ? "border-red-500" : ""}`}
            value={formData.model}
            onChange={(e) => handleChange("model", e.target.value)}
            placeholder="例如：gpt-4, claude-2"
          />
          {errors.model && <div className="col-span-3 col-start-2 text-red-500 text-sm">{errors.model}</div>}
        </div>

        <div className="grid grid-cols-4 items-center gap-4">
          <Label htmlFor="api_base" className="text-right whitespace-nowrap">
            API Base
          </Label>
          <Input
            id="api_base"
            className="col-span-3"
            value={formData.api_base}
            onChange={(e) => handleChange("api_base", e.target.value)}
            placeholder="留空使用默认地址"
          />
        </div>

        <div className="grid grid-cols-4 items-center gap-4">
          <Label htmlFor="api_key" className="text-right whitespace-nowrap">
            API密钥
          </Label>
          <Input
            id="api_key"
            type="password"
            className={`col-span-3 ${errors.api_key ? "border-red-500" : ""}`}
            value={formData.api_key}
            onChange={(e) => handleChange("api_key", e.target.value)}
            placeholder="输入API密钥"
          />
          {errors.api_key && <div className="col-span-3 col-start-2 text-red-500 text-sm">{errors.api_key}</div>}
        </div>

        <div className="grid grid-cols-4 items-center gap-4">
          <Label htmlFor="linked_account" className="text-right whitespace-nowrap">
            关联账户
          </Label>
          <Select
            value={formData.linked_account_id}
            onValueChange={(value) => handleChange("linked_account_id", value)}
          >
            <SelectTrigger className="col-span-3">
              <SelectValue placeholder="选择已连接的账户" />
            </SelectTrigger>
            <SelectContent>
              {accountsLoading ? (
                <SelectItem value="" disabled>
                  加载中...
                </SelectItem>
              ) : linkedAccounts && linkedAccounts.length > 0 ? (
                linkedAccounts.map((account) => (
                  <SelectItem key={account.id} value={account.id}>
                    {account.account_name || account.account_email || "Account"} ({account.platform_name})
                  </SelectItem>
                ))
              ) : (
                <SelectItem value="" disabled>
                  暂无已连接的账户
                </SelectItem>
              )}
            </SelectContent>
          </Select>
        </div>

        <div className="grid grid-cols-4 items-center gap-4">
          <Label htmlFor="is_active" className="text-right whitespace-nowrap">
            启用
          </Label>
          <Switch
            id="is_active"
            checked={formData.is_active}
            onCheckedChange={(checked) => handleChange("is_active", checked)}
            className="col-span-3"
          />
        </div>
      </div>

      <div className="p-6 border-t flex justify-end gap-2 shrink-0">
        <Button type="button" variant="outline" onClick={onCancel}>
          取消
        </Button>
        <Button type="button" onClick={handleSubmit} disabled={loading}>
          {loading ? "保存中..." : "保存"}
        </Button>
      </div>
    </div>
  );
};
