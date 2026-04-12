"use client";

import { Loader2 } from "lucide-react";
import { Button } from "mtxuilib/ui/button";
import { useEffect, useRef } from "react";

interface InfiniteScrollTriggerProps {
  onIntersect: () => void;
  isLoading: boolean;
  hasNextPage: boolean;
  isError?: boolean;
  error?: Error | null;
}

export function InfiniteScrollTrigger({
  onIntersect,
  isLoading,
  hasNextPage,
  isError,
  error,
}: InfiniteScrollTriggerProps) {
  const observerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const element = observerRef.current;
    if (!element || !hasNextPage || isLoading || isError) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) {
          onIntersect();
        }
      },
      {
        root: null,
        rootMargin: "100px", // Preload before reaching bottom
        threshold: 0.1,
      },
    );

    observer.observe(element);

    return () => {
      observer.disconnect();
    };
  }, [hasNextPage, isLoading, isError, onIntersect]);

  if (!hasNextPage) return null;

  return (
    <div ref={observerRef} className="w-full flex justify-center py-4">
      {isError ? (
        <div className="flex flex-col items-center gap-2">
          <p className="text-sm text-destructive">{error?.message || "加载失败"}</p>
          <Button variant="outline" size="sm" onClick={onIntersect}>
            重试
          </Button>
        </div>
      ) : isLoading ? (
        <div className="flex items-center gap-2 text-muted-foreground text-sm">
          <Loader2 className="h-4 w-4 animate-spin" />
          正在加载更多...
        </div>
      ) : (
        <Button variant="ghost" size="sm" onClick={onIntersect} className="text-muted-foreground">
          加载更多
        </Button>
      )}
    </div>
  );
}
