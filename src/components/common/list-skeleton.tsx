"use client";

import { Item, ItemContent, ItemGroup, ItemMedia } from "mtxuilib/ui/item";
import { Skeleton } from "mtxuilib/ui/skeleton";

interface ListSkeletonProps {
  count?: number;
  showMedia?: boolean;
}

export function ListSkeleton({ count = 5, showMedia = true }: ListSkeletonProps) {
  return (
    <ItemGroup>
      {Array.from({ length: count }).map((_, i) => (
        <Item key={i} className="animate-in fade-in duration-500">
          {showMedia && (
            <ItemMedia className="mt-1">
              <Skeleton className="size-8 rounded-full" />
            </ItemMedia>
          )}
          <ItemContent className="space-y-2">
            <Skeleton className="h-5 w-1/3" />
            <Skeleton className="h-4 w-1/2" />
          </ItemContent>
          <div className="flex gap-2">
            <Skeleton className="h-8 w-16" />
            <Skeleton className="h-8 w-8" />
          </div>
        </Item>
      ))}
    </ItemGroup>
  );
}

export function CardSkeleton() {
  return (
    <div className="p-4 space-y-4 rounded-xl border bg-card shadow-sm animate-in fade-in duration-500">
      <div className="flex items-center gap-3">
        <Skeleton className="h-10 w-10 rounded-lg" />
        <div className="flex-1 space-y-2">
          <Skeleton className="h-5 w-32" />
          <Skeleton className="h-4 w-64" />
        </div>
      </div>
      <div className="space-y-2">
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-10 w-full" />
      </div>
      <div className="flex gap-2 pt-2">
        <Skeleton className="h-9 w-24" />
        <Skeleton className="h-9 w-24" />
      </div>
    </div>
  );
}

export function TableSkeleton({ rows = 5, cols = 4 }: { rows?: number; cols?: number }) {
  return (
    <div className="w-full space-y-4 animate-in fade-in duration-500">
      <div className="flex gap-4 border-b pb-4">
        {Array.from({ length: cols }).map((_, i) => (
          <Skeleton key={i} className="h-4 flex-1" />
        ))}
      </div>
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="flex gap-4 py-4 border-b last:border-0 items-center">
          {Array.from({ length: cols }).map((_, j) => (
            <Skeleton key={j} className={j === 0 ? "h-6 w-1/4" : "h-4 flex-1"} />
          ))}
        </div>
      ))}
    </div>
  );
}

export function ChatSkeleton({ count = 4 }: { count?: number }) {
  return (
    <div className="space-y-8 py-8 animate-in fade-in duration-500">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className={`flex gap-4 max-w-2xl ${i % 2 === 0 ? "mr-auto" : "ml-auto flex-row-reverse"}`}>
          <Skeleton className="h-8 w-8 rounded-full shrink-0" />
          <div className={`space-y-2 flex-1 ${i % 2 === 0 ? "" : "text-right"}`}>
            <Skeleton className={`h-4 ${i % 2 === 0 ? "w-3/4" : "ml-auto w-3/4"}`} />
            <Skeleton className={`h-4 ${i % 2 === 0 ? "w-1/2" : "ml-auto w-10/12"}`} />
            <Skeleton className={`h-20 ${i % 2 === 0 ? "w-full" : "ml-auto w-full"} rounded-lg`} />
          </div>
        </div>
      ))}
    </div>
  );
}
