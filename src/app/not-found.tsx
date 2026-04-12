import { FileQuestion, Home } from "lucide-react";
import { cn } from "mtxuilib/lib/utils";
import { Button } from "mtxuilib/ui/button";
import Link from "next/link";

const funMessages = [
  "也许这个页面去度假了 🏖️",
  "这个页面可能被外星人带走了 👽",
  "这个页面正在打盹 😴",
  "页面跑去喝咖啡了 ☕",
  "这个页面在另一个维度 🌌",
  "页面去参加派对了 🎉",
  "这个页面迷路了 🗺️",
  "页面正在修炼中 🧘",
];

const notFoundFunMessage = funMessages[0];

function NotFoundHeader() {
  return (
    <header className="sticky top-0 z-40 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container mx-auto flex h-16 items-center justify-between px-4 md:px-6">
        <Link href="/" className="flex items-center space-x-2">
          <span className="text-xl font-bold tracking-tight">GoMTM</span>
        </Link>
        <nav className="flex items-center gap-3">
          <Link
            href="/"
            className={cn("text-sm font-medium text-foreground/70 transition-colors hover:text-foreground")}
          >
            首页
          </Link>
          <Link href="/auth/login">
            <Button size="sm">登录</Button>
          </Link>
        </nav>
      </div>
    </header>
  );
}

export default function NotFound() {
  return (
    <div className="min-h-screen flex flex-col bg-background text-foreground">
      <NotFoundHeader />

      <main className="flex-1 flex items-center justify-center px-4">
        <div className="text-center space-y-6 max-w-md">
          <div className="flex justify-center">
            <div className="p-6 bg-slate-100 dark:bg-slate-800 rounded-full">
              <FileQuestion className="h-20 w-20 text-muted-foreground animate-bounce" />
            </div>
          </div>

          <div className="space-y-2">
            <h1 className="text-4xl font-bold tracking-tight">404</h1>
            <h2 className="text-2xl font-semibold">页面未找到</h2>
            <p className="text-muted-foreground">抱歉，您访问的页面不存在或已被移除。</p>
            <p className="text-sm text-muted-foreground/80 italic pt-2">{notFoundFunMessage}</p>
          </div>

          <div className="flex flex-col sm:flex-row gap-3 justify-center pt-4">
            <Link href="/">
              <Button size="lg" className="w-full sm:w-auto">
                <Home className="mr-2 h-4 w-4" />
                返回首页
              </Button>
            </Link>
            <Link href="/dash">
              <Button variant="outline" size="lg" className="w-full sm:w-auto">
                进入控制台
              </Button>
            </Link>
          </div>
        </div>
      </main>

      <footer className="border-t py-8 text-center text-sm text-muted-foreground">
        © 2026 GoMTM Inc. All rights reserved.
      </footer>
    </div>
  );
}
