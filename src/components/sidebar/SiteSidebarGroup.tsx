"use client";

import { ChevronRight, Edit, FileText, Folder, ListTodo, MoreHorizontal, Share, Trash2 } from "lucide-react";
import { useIsMobile } from "mtxuilib/hooks/use-mobile";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "mtxuilib/ui/collapsible";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "mtxuilib/ui/dropdown-menu";
import {
  SidebarGroup,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuAction,
  SidebarMenuButton,
  SidebarMenuItem,
} from "mtxuilib/ui/sidebar";
import Link from "next/link";

interface SiteSidebarGroupProps {
  siteId?: string;
}
export const SiteSidebarGroup = (props: SiteSidebarGroupProps) => {
  const isMobile = useIsMobile();
  const { siteId } = props;
  return (
    <Collapsible title={"站点列表"} className="group/collapsible">
      <SidebarGroup className="group-data-[collapsible=icon]:hidden">
        {/* <SidebarGroupLabel>
        <Link href={`/site/${siteId}`}>{siteQuery.data?.title}</Link>
      </SidebarGroupLabel> */}

        <SidebarGroupLabel
          asChild
          className="group/label text-sm text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
        >
          <CollapsibleTrigger>
            <Link href={`/site/${siteId}`}></Link>
            <ChevronRight className="ml-auto transition-transform group-data-[state=open]/collapsible:rotate-90" />
          </CollapsibleTrigger>
        </SidebarGroupLabel>
        <CollapsibleContent>
          <SidebarMenu>
            <SidebarMenuItem>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <SidebarMenuAction showOnHover>
                    <MoreHorizontal />
                    <span className="sr-only">More</span>
                  </SidebarMenuAction>
                </DropdownMenuTrigger>
                <DropdownMenuContent
                  className="w-48"
                  side={isMobile ? "bottom" : "right"}
                  align={isMobile ? "end" : "start"}
                >
                  <DropdownMenuItem>
                    <Folder className="text-muted-foreground" />
                    <span>查看</span>
                  </DropdownMenuItem>
                  <DropdownMenuItem>
                    <Share className="text-muted-foreground" />
                    <span>共享</span>
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem>
                    <Trash2 className="text-muted-foreground" />
                    <span>删除</span>
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </SidebarMenuItem>
            <SidebarMenuItem>
              <SidebarMenuButton>
                <Edit />
                <Link href={`/site/${siteId}/edit`}>
                  <span>站点配置</span>
                </Link>
              </SidebarMenuButton>
            </SidebarMenuItem>
            <SidebarMenuItem>
              <SidebarMenuButton>
                <ListTodo />
                <Link href={`/site/${siteId}/siteauto`}>
                  <span>自动化配置</span>
                </Link>
              </SidebarMenuButton>
            </SidebarMenuItem>
            <SidebarMenuItem>
              <SidebarMenuButton>
                <FileText />
                <Link href={`/site/${siteId}/articles`}>
                  <span>文章</span>
                </Link>
              </SidebarMenuButton>
            </SidebarMenuItem>
            <SidebarMenuItem>
              <SidebarMenuButton>
                <FileText />
                <Link href={`/site/${siteId}/logs`}>
                  <span>日志</span>
                </Link>
              </SidebarMenuButton>
            </SidebarMenuItem>
            <SidebarMenuItem>
              <SidebarMenuButton>
                <ListTodo />
                <Link href={`/site/${siteId}/tasks`}>
                  <span>任务</span>
                </Link>
              </SidebarMenuButton>
            </SidebarMenuItem>
          </SidebarMenu>
        </CollapsibleContent>
      </SidebarGroup>
    </Collapsible>
  );
};
