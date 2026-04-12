"use client";

import { MoreVertical, Phone, Trash2 } from "lucide-react";
import { Button } from "mtxuilib/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "mtxuilib/ui/card";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "mtxuilib/ui/dropdown-menu";
import { useRouter } from "next/navigation";
import type { CloudAccount, TelegramCredentials } from "@/components/cloud-account/schemas";
import { StatusBadge } from "@/components/cloud-account/status/StatusBadge";
import { TelegramLogo } from "./TelegramLogo";

interface TelegramAccountCardProps {
  account: CloudAccount;
  onDelete: (id: string) => void;
}

export function TelegramAccountCard({ account, onDelete }: TelegramAccountCardProps) {
  const router = useRouter();
  const credentials = account.credentials as TelegramCredentials | null;
  const phoneNumber = credentials?.phone_number || account.account_name || "未知号码";
  const username = credentials?.username;
  const firstName = credentials?.first_name;

  return (
    <Card
      className="group hover:shadow-md transition-shadow cursor-pointer"
      onClick={() => router.push(`/dash/cloud-accounts/telegram/${account.id}`)}
    >
      <CardHeader className="pb-2">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <TelegramLogo className="w-10 h-10" />
            <div>
              <CardTitle className="text-base font-medium flex items-center gap-2">
                <Phone className="h-4 w-4 text-muted-foreground" />
                {phoneNumber}
              </CardTitle>
              {(username || firstName) && (
                <CardDescription className="text-sm">
                  {firstName && <span>{firstName}</span>}
                  {username && <span className="text-muted-foreground"> @{username}</span>}
                </CardDescription>
              )}
            </div>
          </div>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity"
                onClick={(e) => e.stopPropagation()}
              >
                <MoreVertical className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem
                onClick={(e) => {
                  e.stopPropagation();
                  onDelete(account.id);
                }}
                className="text-destructive focus:text-destructive"
              >
                <Trash2 className="h-4 w-4 mr-2" />
                删除
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </CardHeader>
      <CardContent className="pt-2">
        <div className="flex items-center justify-between">
          <StatusBadge status={account.status} reason={account.status_reason} />
          <span className="text-xs text-muted-foreground">
            {account.created_at && new Date(account.created_at).toLocaleDateString("zh-CN")}
          </span>
        </div>
      </CardContent>
    </Card>
  );
}
