"use client";

import { LogOut, Settings } from "lucide-react";
import { useSupabaseBrowser } from "mtmsdk/supabase/context";
import { Avatar, AvatarFallback } from "mtxuilib/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "mtxuilib/ui/dropdown-menu";
import { SidebarMenuButton } from "mtxuilib/ui/sidebar";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { toast } from "sonner";

export function UserMenu() {
  const sb = useSupabaseBrowser();
  const router = useRouter();
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    // 获取当前用户信息
    const getUser = async () => {
      const {
        data: { user },
      } = await sb.auth.getUser();
      setUserEmail(user?.email || null);
    };
    getUser();
  }, [sb]);

  const handleSignOut = async () => {
    setIsLoading(true);
    try {
      const { error } = await sb.auth.signOut();
      if (error) throw error;
      toast.success("已退出登录");
      router.push("/auth/login");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "退出登录失败");
    } finally {
      setIsLoading(false);
    }
  };

  // 获取用户名首字母作为头像
  const getInitials = (email: string | null) => {
    if (!email) return "U";
    return email.charAt(0).toUpperCase();
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <SidebarMenuButton
          size="lg"
          className="w-full justify-start bg-transparent hover:bg-sidebar-accent/60 data-[state=open]:bg-sidebar-accent text-sidebar-foreground/90"
        >
          <Avatar className="h-8 w-8 rounded-lg">
            <AvatarFallback className="rounded-lg bg-sidebar-primary text-sidebar-primary-foreground">
              {getInitials(userEmail)}
            </AvatarFallback>
          </Avatar>
          <div className="grid flex-1 text-left text-sm leading-tight">
            <span className="truncate font-semibold">{userEmail ? userEmail.split("@")[0] : "用户"}</span>
            <span className="truncate text-xs text-muted-foreground">{userEmail || "未登录"}</span>
          </div>
        </SidebarMenuButton>
      </DropdownMenuTrigger>
      <DropdownMenuContent className="w-56" align="end" side="top" sideOffset={4}>
        <DropdownMenuLabel className="font-normal">
          <div className="flex flex-col space-y-1">
            <p className="text-sm font-medium leading-none">我的账户</p>
            <p className="text-xs leading-none text-muted-foreground">{userEmail}</p>
          </div>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={() => router.push("/dash/settings")}>
          <Settings className="mr-2 h-4 w-4" />
          <span>设置</span>
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={handleSignOut} disabled={isLoading}>
          <LogOut className="mr-2 h-4 w-4" />
          <span>{isLoading ? "退出中..." : "退出登录"}</span>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
