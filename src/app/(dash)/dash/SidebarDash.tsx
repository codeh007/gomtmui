"use client";

import { Building } from "lucide-react";
import { IconX } from "mtxuilib/icons/icons";
import { Badge } from "mtxuilib/ui/badge";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
  SidebarRail,
} from "mtxuilib/ui/sidebar";
import Link from "next/link";
import { UserMenu } from "@/components/user-menu";
import { DASH_NAV_ITEMS, type NavItem } from "@/config/navigation";
import { useCurrentUserRole } from "@/hooks/use-current-user-role";

interface SidebarDashProps {
  pathname: string;
}

export function SidebarDash({ pathname }: SidebarDashProps) {
  const { isAdmin, isLoading } = useCurrentUserRole();

  const filteredNavItems = DASH_NAV_ITEMS.filter((item) => {
    if (!item.requiredRole) return true;
    if (item.requiredRole === "admin") return isAdmin;
    return true;
  });

  if (isLoading) {
    return (
      <Sidebar variant="inset">
        <SidebarHeader>
          <SidebarMenu>
            <SidebarMenuItem>
              <SidebarMenuButton size="lg" asChild>
                <Link href="/dash">
                  <div className="flex aspect-square size-8 items-center justify-center rounded-lg bg-sidebar-primary text-sidebar-primary-foreground">
                    <Building className="size-4" />
                  </div>
                  <div className="grid flex-1 text-left text-sm leading-tight">
                    <span className="truncate font-semibold">GOMTM</span>
                    <span className="truncate text-xs">管理后台</span>
                  </div>
                </Link>
              </SidebarMenuButton>
            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarHeader>
        <SidebarContent>
          <SidebarGroup>
            <SidebarGroupLabel>导航</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu />
            </SidebarGroupContent>
          </SidebarGroup>
        </SidebarContent>
        <SidebarFooter>
          <SidebarMenu>
            <SidebarMenuItem>
              <UserMenu />
            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarFooter>
        <SidebarRail />
      </Sidebar>
    );
  }

  return (
    <Sidebar variant="inset">
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton size="lg" asChild>
              <Link href="/dash">
                <div className="flex aspect-square size-8 items-center justify-center rounded-lg bg-sidebar-primary text-sidebar-primary-foreground">
                  <Building className="size-4" />
                </div>
                <div className="grid flex-1 text-left text-sm leading-tight">
                  <span className="truncate font-semibold">GOMTM</span>
                  <span className="truncate text-xs">管理后台</span>
                </div>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>导航</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {filteredNavItems.map((item) => (
                <NavItemView key={item.label} item={item} pathname={pathname} />
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter>
        <SidebarMenu>
          <SidebarMenuItem>
            <UserMenu />
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  );
}

const NavItemView = (props: { item: NavItem; pathname: string }) => {
  const { item, pathname } = props;
  const hasChildren = item.children && item.children.length > 0;
  const isActive = !!(pathname === item.url || (item.url && item.url !== "/" && pathname?.startsWith(`${item.url}/`)));

  if (hasChildren) {
    return (
      <SidebarMenuItem>
        <SidebarMenuButton asChild isActive={isActive} tooltip={item.tooltip}>
          {item.url ? (
            <Link href={item.url}>
              {item.icon && <IconX name={item.icon} />}
              <span>{item.label}</span>
            </Link>
          ) : (
            <span>
              {item.icon && <IconX name={item.icon} />}
              <span>{item.label}</span>
            </span>
          )}
        </SidebarMenuButton>
        <SidebarMenuSub>
          {item.children?.map((child) => (
            <SidebarMenuSubView key={child.label} item={child} pathname={pathname} />
          ))}
        </SidebarMenuSub>
      </SidebarMenuItem>
    );
  }

  return (
    <SidebarMenuItem>
      <SidebarMenuButton asChild isActive={isActive} tooltip={item.tooltip}>
        {item.url ? (
          <Link href={item.url}>
            {item.icon && <IconX name={item.icon} />}
            <span>{item.label}</span>
            {item.badge && (
              <Badge variant="secondary" className="ml-auto">
                {item.badge}
              </Badge>
            )}
          </Link>
        ) : (
          <span className="flex w-full">
            {item.icon && <IconX name={item.icon} />}
            <span>{item.label}</span>
          </span>
        )}
      </SidebarMenuButton>
    </SidebarMenuItem>
  );
};

const SidebarMenuSubView = ({ item, pathname }: { item: NavItem; pathname: string }) => {
  const isActive = pathname === item.url;
  return (
    <SidebarMenuSubItem>
      <SidebarMenuSubButton asChild isActive={isActive}>
        <Link href={item.url || "#"}>
          <span>{item.label}</span>
        </Link>
      </SidebarMenuSubButton>
    </SidebarMenuSubItem>
  );
};
