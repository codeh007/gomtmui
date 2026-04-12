"use client";

import { Skeleton } from "mtxuilib/ui/skeleton";

export function ChatSkeleton() {
  return (
    <div className="flex flex-col h-full w-full max-w-4xl mx-auto p-4 space-y-4">
      <div className="flex items-center space-x-4">
        <Skeleton className="size-10 rounded-full" />
        <div className="space-y-2">
          <Skeleton className="h-4 w-[250px]" />
          <Skeleton className="h-4 w-[200px]" />
        </div>
      </div>
      <div className="space-y-4 pt-10">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className={`flex ${i % 2 === 0 ? "justify-start" : "justify-end"}`}>
            <div className={`space-y-2 max-w-[80%] ${i % 2 === 0 ? "items-start" : "items-end"}`}>
              <Skeleton
                className={`h-10 w-[300px] rounded-2xl ${i % 2 === 0 ? "rounded-tl-none" : "rounded-tr-none"}`}
              />
              <Skeleton className="h-3 w-[100px]" />
            </div>
          </div>
        ))}
      </div>
      <div className="mt-auto pt-4 flex gap-2">
        <Skeleton className="h-10 flex-1 rounded-md" />
        <Skeleton className="h-10 w-10 rounded-md" />
      </div>
    </div>
  );
}
