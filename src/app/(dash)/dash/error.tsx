"use client";

import { AlertTriangle, Home, RefreshCw } from "lucide-react";
import { Button } from "mtxuilib/ui/button";
import { useRouter } from "next/navigation";
import { useEffect } from "react";

export default function DashboardError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  const router = useRouter();

  useEffect(() => {
    console.error("Application error:", error);
  }, [error]);

  const handleGoHome = () => {
    router.push("/dash");
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-[50vh] p-6">
      <div className="flex flex-col items-center gap-4 text-center max-w-md">
        <div className="bg-destructive/10 p-4 rounded-full">
          <AlertTriangle className="h-10 w-10 text-destructive" />
        </div>
        <div className="space-y-2">
          <h2 className="text-xl font-semibold">页面加载失败</h2>
          <p className="text-sm text-muted-foreground">抱歉，页面发生错误，请尝试重新加载。</p>
          {error.digest && <p className="text-xs text-muted-foreground font-mono">Error ID: {error.digest}</p>}
        </div>
        <div className="flex gap-3 mt-2">
          <Button variant="outline" onClick={reset}>
            <RefreshCw className="mr-2 h-4 w-4" />
            重试
          </Button>
          <Button variant="ghost" onClick={handleGoHome}>
            <Home className="mr-2 h-4 w-4" />
            返回首页
          </Button>
        </div>
      </div>
    </div>
  );
}
