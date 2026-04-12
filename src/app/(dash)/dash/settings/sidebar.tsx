"use client";

import { Blocks, ChevronLeft, Settings, User } from "lucide-react";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
  SidebarSeparator,
} from "mtxuilib/ui/sidebar";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useCurrentUserRole } from "@/hooks/use-current-user-role";

const settingsNavItems = [
  {
    title: "个人资料",
    url: "/dash/settings/profile",
    icon: User,
  },
  {
    title: "系统配置",
    url: "/dash/settings/system",
    icon: Settings,
    adminOnly: true,
  },

  {
    title: "集成",
    url: "/dash/settings/integrations",
    icon: Blocks,
    adminOnly: true,
  },
];

export function SidebarSettings() {
  const pathname = usePathname();
  const { isAdmin } = useCurrentUserRole();

  const filteredItems = settingsNavItems.filter((item) => {
    if (!item.adminOnly) return true;
    return isAdmin;
  });

  return (
    <Sidebar variant="inset" collapsible="icon">
      <SidebarHeader>
        <SidebarMenu>
          {/* 返回主控制台链接 */}
          <SidebarMenuItem>
            <SidebarMenuButton size="sm" asChild tooltip="返回主控制台">
              <Link href="/dash" className="text-muted-foreground hover:text-foreground">
                <ChevronLeft className="size-4" />
                <span>返回控制台</span>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
          <SidebarSeparator className="my-1" />
          {/* 设置页面标题 */}
          <SidebarMenuItem>
            <SidebarMenuButton size="lg" asChild>
              <Link href="/dash/settings">
                <div className="flex aspect-square size-8 items-center justify-center rounded-lg bg-sidebar-primary text-sidebar-primary-foreground">
                  <Settings className="size-4" />
                </div>
                <div className="flex flex-col gap-0.5 leading-none">
                  <span className="font-semibold truncate">账户设置</span>
                  <span className="text-xs opacity-70">个人中心</span>
                </div>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>账户</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {filteredItems.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton asChild isActive={pathname === item.url} tooltip={item.title}>
                    <Link href={item.url}>
                      <item.icon />
                      <span>{item.title}</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
      <SidebarRail />
    </Sidebar>
  );
}
