"use client";

import { useQueryClient } from "@tanstack/react-query";
import { Loader2, Plus, RefreshCw, Search } from "lucide-react";
import { useRpcMutation } from "mtmsdk/supabase/use-sb-query/use-rpc-mutation";
import { getRpcQueryKey } from "mtmsdk/supabase/use-sb-query/use-rpc-query";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "mtxuilib/ui/breadcrumb";
import { Button } from "mtxuilib/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "mtxuilib/ui/dialog";
import { Input } from "mtxuilib/ui/input";
import { useState } from "react";
import { toast } from "sonner";
import { PhoneVerificationFlow } from "@/components/cloud-account/auth-flows/PhoneVerificationFlow";
import { useCloudAccounts } from "@/components/cloud-account/hooks/useCloudAccounts";
import { DashContent, DashHeaders } from "@/components/dash-layout";
import { PLATFORM_CONFIGS } from "@/lib/cloud-account/platform-configs";
import { TelegramAccountCard } from "./components/TelegramAccountCard";
import { TelegramLogo } from "./components/TelegramLogo";

export default function TelegramAccountsPage() {
  const [kw, setKw] = useState("");
  const [addDialogOpen, setAddDialogOpen] = useState(false);

  const { data, fetchNextPage, hasNextPage, isFetchingNextPage, isLoading, isError, error, refetch } = useCloudAccounts(
    {
      kw,
      platformName: "telegram",
      pageSize: 20,
    },
  );

  const queryClient = useQueryClient();
  const deleteMutation = useRpcMutation("cloud_account_delete", {
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: getRpcQueryKey("cloud_account_list_cursor") });
      toast.success("账号已删除");
    },
    onError: (err) => {
      toast.error(`删除失败: ${err.message}`);
    },
  });

  const accounts = data?.pages.flat() || [];

  const handleDelete = (id: string) => {
    if (confirm("确定要删除这个 Telegram 账号吗？")) {
      deleteMutation.mutate({ p_id: id });
    }
  };

  return (
    <>
      <DashHeaders>
        <Breadcrumb>
          <BreadcrumbList>
            <BreadcrumbItem>
              <BreadcrumbLink href="/dash">Dashboard</BreadcrumbLink>
            </BreadcrumbItem>
            <BreadcrumbSeparator />
            <BreadcrumbItem>
              <BreadcrumbLink href="/dash/cloud-accounts">Cloud Accounts</BreadcrumbLink>
            </BreadcrumbItem>
            <BreadcrumbSeparator />
            <BreadcrumbItem>
              <BreadcrumbPage>Telegram</BreadcrumbPage>
            </BreadcrumbItem>
          </BreadcrumbList>
        </Breadcrumb>
      </DashHeaders>

      <DashContent className="flex flex-col gap-4 p-4 md:p-6 overflow-hidden">
        {/* 页面标题和操作栏 */}
        <div className="flex flex-col md:flex-row gap-4 justify-between items-start md:items-center">
          <div className="flex items-center gap-3">
            <TelegramLogo className="w-10 h-10" />
            <div>
              <h1 className="text-2xl font-semibold">Telegram 账号</h1>
              <p className="text-sm text-muted-foreground">管理您的 Telegram 账号</p>
            </div>
          </div>

          <div className="flex gap-2 items-center">
            <div className="relative">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                type="search"
                placeholder="搜索手机号..."
                className="pl-9 w-[200px]"
                value={kw}
                onChange={(e) => setKw(e.target.value)}
              />
            </div>

            <Button variant="outline" size="icon" onClick={() => refetch()} title="刷新">
              <RefreshCw className="h-4 w-4" />
            </Button>

            <Dialog open={addDialogOpen} onOpenChange={setAddDialogOpen}>
              <DialogTrigger asChild>
                <Button>
                  <Plus className="mr-2 h-4 w-4" />
                  添加账号
                </Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-[425px]">
                <DialogHeader>
                  <DialogTitle>批量添加 Telegram 账号</DialogTitle>
                  <DialogDescription>Enter phone numbers, one per line. Example: +1234567890</DialogDescription>
                </DialogHeader>
                <PhoneVerificationFlow
                  platform={PLATFORM_CONFIGS.telegram}
                  onSuccess={() => setAddDialogOpen(false)}
                  onCancel={() => setAddDialogOpen(false)}
                />
              </DialogContent>
            </Dialog>
          </div>
        </div>

        {/* 账号列表 */}
        <div className="flex-1 overflow-y-auto min-h-0">
          {isLoading ? (
            <div className="flex justify-center items-center h-40">
              <Loader2 className="animate-spin h-8 w-8 text-muted-foreground" />
            </div>
          ) : isError ? (
            <div className="flex flex-col justify-center items-center h-40 text-red-500">
              <p>加载失败: {error?.message}</p>
              <Button variant="outline" onClick={() => refetch()} className="mt-2">
                重试
              </Button>
            </div>
          ) : accounts.length === 0 ? (
            <div className="flex flex-col justify-center items-center h-60 text-muted-foreground border-2 border-dashed rounded-lg">
              <TelegramLogo className="w-16 h-16 opacity-50 mb-4" />
              <p className="text-lg font-medium mb-2">暂无 Telegram 账号</p>
              <p className="text-sm mb-4">添加您的第一个 Telegram 账号开始使用</p>
              <Button onClick={() => setAddDialogOpen(true)}>
                <Plus className="mr-2 h-4 w-4" />
                添加账号
              </Button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 pb-4">
              {accounts.map((account) => (
                <TelegramAccountCard key={account.id} account={account} onDelete={handleDelete} />
              ))}
            </div>
          )}

          {hasNextPage && (
            <div className="flex justify-center py-4">
              <Button variant="ghost" onClick={() => fetchNextPage()} disabled={isFetchingNextPage}>
                {isFetchingNextPage ? <Loader2 className="animate-spin h-4 w-4 mr-2" /> : null}
                加载更多
              </Button>
            </div>
          )}
        </div>
      </DashContent>
    </>
  );
}
