"use client";

import { useQueryClient } from "@tanstack/react-query";
import { useRpcMutation } from "mtmsdk/supabase/use-sb-query/use-rpc-mutation";
import { getRpcQueryKey } from "mtmsdk/supabase/use-sb-query/use-rpc-query";
import { Button } from "mtxuilib/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "mtxuilib/ui/dialog";
import { Input } from "mtxuilib/ui/input";
import { Label } from "mtxuilib/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "mtxuilib/ui/select";
import { Textarea } from "mtxuilib/ui/textarea";
import { useState } from "react";
import { toast } from "sonner";

export function CreateTaskDialog({
  children,
  contextType,
  contextId,
}: {
  children: React.ReactNode;
  contextType?: string;
  contextId?: string;
}) {
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [codeType, setCodeType] = useState<string>("sql");
  const [code, setCode] = useState("");
  const [priority, setPriority] = useState(0);
  const [tags, setTags] = useState("");
  const [status, setStatus] = useState<string>("pending");

  const queryClient = useQueryClient();

  const { mutate, isPending } = useRpcMutation("task_upsert", {
    onSuccess: () => {
      setOpen(false);
      void queryClient.invalidateQueries({ queryKey: getRpcQueryKey("task_list_cursor") });
      resetForm();
    },
    onError: (error) => {
      toast.error(`操作失败: ${error.message}`);
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    mutate({
      p_title: title,
      p_description: description || undefined,
      p_code_type: codeType as "sql" | "bash" | "python" | "agent",
      p_code: code,
      p_priority: priority,
      p_status: status as "draft" | "pending",
      p_context_type: contextType || undefined,
      p_context_id: contextId || undefined,
      p_tags: tags
        .split(",")
        .map((t) => t.trim())
        .filter(Boolean),
    });
  };

  const resetForm = () => {
    setTitle("");
    setDescription("");
    setCodeType("sql");
    setCode("");
    setPriority(0);
    setTags("");
    setStatus("pending");
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>新建任务</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4 py-2">
          {/* Title */}
          <div className="grid gap-2">
            <Label htmlFor="title">标题</Label>
            <Input
              id="title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="任务名称"
              required
            />
          </div>

          {/* Description */}
          <div className="grid gap-2">
            <Label htmlFor="description">描述 (可选)</Label>
            <Textarea
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="任务描述..."
              className="resize-none h-20"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            {/* Code Type */}
            <div className="grid gap-2">
              <Label htmlFor="code_type">类型</Label>
              <Select value={codeType} onValueChange={setCodeType}>
                <SelectTrigger>
                  <SelectValue placeholder="选择类型" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="sql">SQL Query</SelectItem>
                  <SelectItem value="bash">Bash Script</SelectItem>
                  <SelectItem value="python">Python Script</SelectItem>
                  <SelectItem value="agent">AI Agent Instruction</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Priority */}
            <div className="grid gap-2">
              <Label htmlFor="priority">优先级 (0-9)</Label>
              <Input
                id="priority"
                type="number"
                value={priority}
                onChange={(e) => setPriority(parseInt(e.target.value, 10))}
                max={9}
                min={0}
              />
            </div>
          </div>

          {/* Code/Instruction */}
          <div className="grid gap-2">
            <Label htmlFor="code">{codeType === "agent" ? "指令 / Prompt" : "代码 / 脚本"}</Label>
            <Textarea
              id="code"
              value={code}
              onChange={(e) => setCode(e.target.value)}
              className="font-mono text-xs min-h-[200px]"
              placeholder={
                codeType === "agent"
                  ? "请输入自然语言指令，例如：查询所有活跃用户并发送问候邮件..."
                  : "-- 在此输入代码..."
              }
              required
            />
          </div>

          {/* Tags */}
          <div className="grid gap-2">
            <Label htmlFor="tags">标签 (逗号分隔)</Label>
            <Input
              id="tags"
              value={tags}
              onChange={(e) => setTags(e.target.value)}
              placeholder="e.g. daily, maintenance, urgent"
            />
          </div>

          <div className="flex items-center justify-between pt-4 border-t">
            <div className="flex items-center gap-2">
              <Label htmlFor="create_status" className="text-xs text-muted-foreground">
                完成动作:
              </Label>
              <Select value={status} onValueChange={setStatus}>
                <SelectTrigger id="create_status" className="w-[140px] h-8 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="pending">提交并执行</SelectItem>
                  <SelectItem value="draft">保存为草稿</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-center gap-2">
              <Button type="button" variant="outline" size="sm" onClick={() => setOpen(false)}>
                取消
              </Button>
              <Button type="submit" size="sm" disabled={isPending}>
                {isPending ? "处理中..." : status === "pending" ? "立即提交" : "保存草稿"}
              </Button>
            </div>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
