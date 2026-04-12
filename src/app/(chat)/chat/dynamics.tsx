"use client";
import { Skeleton } from "mtxuilib/ui/skeleton";
import dynamic from "next/dynamic";

export const Chatv2Lazy = dynamic(() => import("@/components/chatv2/chatv2").then((x) => x.Chatv2), {
  loading: () => <Skeleton className="h-full w-full" />,
  ssr: false,
});

export const AisdkChatSidebarLazy = dynamic(() => import("./ChatSidebar").then((x) => x.AisdkChatSidebar), {
  loading: () => <Skeleton className="h-full w-64" />,
  ssr: false,
});
