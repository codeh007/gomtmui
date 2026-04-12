"use client";

import { useQueryClient } from "@tanstack/react-query";
import { FileUp, FilterX, Search, Tag, Trash2 } from "lucide-react";
import { useRpcMutation } from "mtmsdk/supabase/use-sb-query/use-rpc-mutation";
import { getRpcQueryKey, useRpcQuery } from "mtmsdk/supabase/use-sb-query/use-rpc-query";
import { InlineLoading } from "mtxuilib/mt/skeletons";
import { Badge } from "mtxuilib/ui/badge";
import { Button } from "mtxuilib/ui/button";
import { Checkbox } from "mtxuilib/ui/checkbox";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "mtxuilib/ui/dialog";
import { Input } from "mtxuilib/ui/input";
import { Label } from "mtxuilib/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "mtxuilib/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "mtxuilib/ui/table";
import Link from "next/link";
import { useState } from "react";
import { z } from "zod";
import { ContactRecordSchema, ContactStatusEnum } from "@/components/contacts/schemas";
import { DashContent, DashHeaders } from "@/components/dash-layout";
import { useDebounce } from "@/hooks/use-debounce";

const statusColors: Record<string, string> = {
  active: "bg-emerald-500/15 text-emerald-600 border-emerald-500/30",
  blocked: "bg-red-500/15 text-red-600 border-red-500/30",
  invalid: "bg-zinc-500/15 text-zinc-600 border-zinc-500/30",
};

export default function ContactsPage() {
  const queryClient = useQueryClient();
  const [kw, setKw] = useState("");
  const [platform, setPlatform] = useState("all");
  const [status, setStatus] = useState("all");
  const [tags, setTags] = useState<string[]>([]); // Current selected tags filter
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [tagDialogOpen, setTagDialogOpen] = useState(false);
  const [tagAction, setTagAction] = useState<"add" | "remove">("add");
  const [inputTags, setInputTags] = useState("");

  const kwDebounced = useDebounce(kw, 500);

  const { data: contacts, isLoading } = useRpcQuery(
    "contact_list_cursor",
    {
      p_limit: 100,
      ...(platform !== "all" && { p_platform: platform }),
      ...(status !== "all" && { p_status: status }),
      ...(tags.length > 0 && { p_tags: tags }),
      ...(kwDebounced && { p_search: kwDebounced }),
    },
    { schema: z.array(ContactRecordSchema) },
  );

  const { data: allTags } = useRpcQuery("contact_list_tags", undefined, {
    schema: z.array(z.string()),
  });

  const deleteMutation = useRpcMutation("contact_delete", {
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: getRpcQueryKey("contact_list_cursor") });
      setSelectedIds(new Set());
      setDeleteDialogOpen(false);
    },
  });

  const addTagsMutation = useRpcMutation("contact_add_tags", {
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: getRpcQueryKey("contact_list_cursor") });
      queryClient.invalidateQueries({ queryKey: getRpcQueryKey("contact_list_tags") });
      setTagDialogOpen(false);
      setInputTags("");
      setSelectedIds(new Set()); // Clear selection after action
    },
  });

  const removeTagsMutation = useRpcMutation("contact_remove_tags", {
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: getRpcQueryKey("contact_list_cursor") });
      queryClient.invalidateQueries({ queryKey: getRpcQueryKey("contact_list_tags") });
      setTagDialogOpen(false);
      setInputTags("");
      setSelectedIds(new Set()); // Clear selection after action
    },
  });

  const handleResetFilters = () => {
    setKw("");
    setPlatform("all");
    setStatus("all");
    setTags([]);
  };

  const hasActiveFilters = kw || platform !== "all" || status !== "all" || tags.length > 0;

  const toggleSelection = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleAll = () => {
    if (!contacts) return;
    if (selectedIds.size === contacts.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(contacts.map((c) => c.id)));
    }
  };

  const handleBulkDelete = () => {
    if (selectedIds.size === 0) return;
    deleteMutation.mutate({ p_ids: Array.from(selectedIds) });
  };

  const handleBulkTagAction = () => {
    if (selectedIds.size === 0) return;
    const tagList = inputTags
      .split(/[,，;；]/)
      .map((t) => t.trim())
      .filter(Boolean);

    if (tagList.length === 0) return;

    if (tagAction === "add") {
      addTagsMutation.mutate({ p_ids: Array.from(selectedIds), p_tags: tagList });
    } else {
      removeTagsMutation.mutate({ p_ids: Array.from(selectedIds), p_tags: tagList });
    }
  };

  const openTagDialog = (action: "add" | "remove") => {
    setTagAction(action);
    setTagDialogOpen(true);
  };

  return (
    <>
      <DashHeaders>
        <div className="flex flex-col">
          <h1 className="text-lg font-semibold">联系人</h1>
          <p className="text-xs text-muted-foreground">管理社交媒体联系人</p>
        </div>
      </DashHeaders>

      <DashContent className="flex flex-col gap-4 p-4 md:p-6 overflow-hidden">
        {/* 工具栏 */}
        <div className="flex flex-col md:flex-row gap-3 justify-between items-start md:items-center">
          <div className="flex flex-1 w-full md:w-auto gap-2 items-center">
            <div className="relative flex-1 md:max-w-sm">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                type="search"
                placeholder="搜索联系人..."
                className="pl-9"
                value={kw}
                onChange={(e) => setKw(e.target.value)}
              />
            </div>

            <Select value={platform} onValueChange={setPlatform}>
              <SelectTrigger className="w-[150px]">
                <SelectValue placeholder="平台" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">所有平台</SelectItem>
                <SelectItem value="telegram">Telegram</SelectItem>
                <SelectItem value="whatsapp">WhatsApp</SelectItem>
              </SelectContent>
            </Select>

            <Select value={status} onValueChange={setStatus}>
              <SelectTrigger className="w-[130px]">
                <SelectValue placeholder="状态" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">所有状态</SelectItem>
                {ContactStatusEnum.options.map((s) => (
                  <SelectItem key={s} value={s} className="capitalize">
                    {s === "active" ? "有效" : s === "blocked" ? "已拉黑" : "无效"}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {/* Tag Filter */}
            <Select
              value={tags.length > 0 ? tags.join(",") : "all"}
              onValueChange={(val) => setTags(val === "all" ? [] : val.split(","))}
            >
              <SelectTrigger className="w-[130px]">
                <SelectValue placeholder="标签" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">所有标签</SelectItem>
                {allTags?.map((tag) => (
                  <SelectItem key={tag} value={tag}>
                    {tag}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {hasActiveFilters && (
              <Button variant="ghost" size="icon" onClick={handleResetFilters} title="重置筛选">
                <FilterX className="h-4 w-4" />
              </Button>
            )}
          </div>

          <div className="flex gap-2">
            <Button variant="outline" asChild>
              <Link href="/dash/contacts/import">
                <FileUp className="mr-1.5 h-4 w-4" />
                导入
              </Link>
            </Button>
            {selectedIds.size > 0 && (
              <>
                <Button variant="outline" size="sm" onClick={() => openTagDialog("add")}>
                  <Tag className="mr-1.5 h-4 w-4" />
                  添加标签
                </Button>
                <Button variant="outline" size="sm" onClick={() => openTagDialog("remove")}>
                  <Tag className="mr-1.5 h-4 w-4" />
                  移除标签
                </Button>
                <Button variant="destructive" size="sm" onClick={() => setDeleteDialogOpen(true)}>
                  <Trash2 className="mr-1.5 h-4 w-4" />
                  删除 ({selectedIds.size})
                </Button>
              </>
            )}
          </div>
        </div>

        {/* 联系人列表 */}
        <div className="flex-1 min-h-0 overflow-auto rounded-lg border border-border/50">
          {isLoading ? (
            <InlineLoading />
          ) : !contacts || contacts.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-muted-foreground gap-3">
              <p className="text-lg font-medium">暂无联系人</p>
              <p className="text-sm">通过 CSV 文件导入联系人开始推广</p>
              <Button variant="outline" asChild>
                <Link href="/dash/contacts/import">
                  <FileUp className="mr-1.5 h-4 w-4" />
                  导入联系人
                </Link>
              </Button>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/30">
                  <TableHead className="w-[40px]">
                    <Checkbox
                      checked={selectedIds.size === contacts.length && contacts.length > 0}
                      onCheckedChange={toggleAll}
                    />
                  </TableHead>
                  <TableHead>姓名</TableHead>
                  <TableHead>手机号</TableHead>
                  <TableHead>Telegram</TableHead>
                  <TableHead>标签</TableHead>
                  <TableHead>状态</TableHead>
                  <TableHead>来源</TableHead>
                  <TableHead>创建时间</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {contacts.map((contact) => (
                  <TableRow key={contact.id} className="group hover:bg-muted/20">
                    <TableCell>
                      <Checkbox
                        checked={selectedIds.has(contact.id)}
                        onCheckedChange={() => toggleSelection(contact.id)}
                      />
                    </TableCell>
                    <TableCell className="font-medium">
                      {contact.name || <span className="text-muted-foreground italic">未命名</span>}
                    </TableCell>
                    <TableCell className="font-mono text-sm">{contact.phone || "-"}</TableCell>
                    <TableCell className="text-sm">
                      {contact.telegram_username ? (
                        <span className="text-blue-500">@{contact.telegram_username}</span>
                      ) : contact.telegram_id ? (
                        <span className="text-muted-foreground">ID: {contact.telegram_id}</span>
                      ) : (
                        "-"
                      )}
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-1 flex-wrap">
                        {contact.tags?.map((tag) => (
                          <Badge key={tag} variant="outline" className="text-xs px-1.5 py-0">
                            {tag}
                          </Badge>
                        ))}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className={statusColors[contact.status || "active"] || ""}>
                        {contact.status === "active"
                          ? "有效"
                          : contact.status === "blocked"
                            ? "已拉黑"
                            : contact.status === "invalid"
                              ? "无效"
                              : contact.status || "有效"}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {contact.source === "csv"
                        ? "CSV导入"
                        : contact.source === "manual"
                          ? "手动添加"
                          : contact.source || "-"}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {contact.created_at ? new Date(contact.created_at).toLocaleDateString("zh-CN") : "-"}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </div>
      </DashContent>

      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>确认删除</DialogTitle>
            <DialogDescription>确定要删除选中的 {selectedIds.size} 个联系人吗？此操作无法撤销。</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteDialogOpen(false)}>
              取消
            </Button>
            <Button variant="destructive" onClick={handleBulkDelete} disabled={deleteMutation.isPending}>
              {deleteMutation.isPending ? "删除中..." : "确认删除"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <TagDialog
        open={tagDialogOpen}
        onOpenChange={setTagDialogOpen}
        action={tagAction}
        inputTags={inputTags}
        setInputTags={setInputTags}
        onConfirm={handleBulkTagAction}
        isPending={addTagsMutation.isPending || removeTagsMutation.isPending}
      />
    </>
  );
}

function TagDialog({
  open,
  onOpenChange,
  action,
  inputTags,
  setInputTags,
  onConfirm,
  isPending,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  action: "add" | "remove";
  inputTags: string;
  setInputTags: (val: string) => void;
  onConfirm: () => void;
  isPending: boolean;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{action === "add" ? "添加标签" : "移除标签"}</DialogTitle>
          <DialogDescription>
            {action === "add" ? "输入要添加的标签，多个标签用逗号分隔。" : "输入要移除的标签，多个标签用逗号分隔。"}
          </DialogDescription>
        </DialogHeader>
        <div className="py-4">
          <Label htmlFor="tags" className="text-right">
            标签
          </Label>
          <Input
            id="tags"
            value={inputTags}
            onChange={(e) => setInputTags(e.target.value)}
            placeholder="例如: VIP, 新客户"
            className="col-span-3 mt-2"
          />
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            取消
          </Button>
          <Button onClick={onConfirm} disabled={isPending}>
            {isPending ? "处理中..." : "确认"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
