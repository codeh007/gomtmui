"use client";

import { MtErrorBoundary } from "mtxuilib/components/MtErrorBoundary";
import { cn } from "mtxuilib/lib/utils";
import { SidebarToggle } from "mtxuilib/mt/sidebar-toggle";
import { InlineLoading } from "mtxuilib/mt/skeletons";

import { Separator } from "mtxuilib/ui/separator";
import { SidebarProvider } from "mtxuilib/ui/sidebar";
import { type PropsWithChildren, Suspense } from "react";
import { NotificationCenter } from "./notifications/NotificationCenter";

interface RootAppWrapperProps extends PropsWithChildren {
  className?: string;
  defaultOpen?: boolean;
}

export function DashRoot({ children, className, defaultOpen }: RootAppWrapperProps) {
  return (
    <SidebarProvider
      defaultOpen={defaultOpen}
      className={className}
      style={
        {
          "--sidebar-width": "280px",
        } as React.CSSProperties
      }
    >
      {children}
    </SidebarProvider>
  );
}

interface DashContentProps extends PropsWithChildren {
  className?: string; // 控制外层容器样式
  innerClassName?: string; // 控制内层容器样式 (如 padding)
}

export const DashContent = ({ children, className, innerClassName }: DashContentProps) => {
  return (
    <div className={cn("flex flex-1 flex-col min-h-0 overflow-auto", className)}>
      <Suspense fallback={<InlineLoading />}>
        <MtErrorBoundary>
          <div className={cn("flex flex-1 flex-col min-h-0 p-4", innerClassName)}>{children}</div>
        </MtErrorBoundary>
      </Suspense>
    </div>
  );
};

export const DashHeaders = (props: { borderBottom?: boolean; children?: React.ReactNode; className?: string }) => {
  return (
    <header
      className={cn(
        "sticky top-0 z-10 flex flex-row shrink-0 items-center gap-2 bg-background/95 backdrop-blur supports-backdrop-filter:bg-background/60 px-4 py-3 border-b border-border/40",
        props.className,
      )}
    >
      <SidebarToggle className="-ml-1" />
      <Separator orientation="vertical" className="mr-2 h-4" />
      <div className="flex flex-1 items-center gap-2">{props.children}</div>
      {/* 通知中心 */}
      <Suspense fallback={null}>
        <NotificationCenter />
      </Suspense>
    </header>
  );
};
