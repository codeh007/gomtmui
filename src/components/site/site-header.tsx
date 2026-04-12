"use client";

import { Menu } from "lucide-react";
import { useSupabaseBrowser } from "mtmsdk/supabase/context";
import { Avatar, AvatarFallback, AvatarImage } from "mtxuilib/ui/avatar";
import { Button } from "mtxuilib/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "mtxuilib/ui/dropdown-menu";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "mtxuilib/ui/sheet";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

export function SiteHeader() {
  const [user, setUser] = useState<any>(null);
  const supabase = useSupabaseBrowser();
  const router = useRouter();

  useEffect(() => {
    const getUser = async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      setUser(user);
    };
    getUser();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
    });

    return () => {
      subscription.unsubscribe();
    };
  }, [supabase]);

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    router.refresh();
  };

  return (
    <header className="sticky top-0 z-40 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container flex h-16 items-center justify-between px-4 md:px-6 mx-auto">
        <div className="flex items-center gap-6">
          <Link href="/" className="flex items-center space-x-2">
            <span className="text-xl font-bold tracking-tight">GoMTM</span>
          </Link>
          <nav className="hidden md:flex items-center space-x-6 text-sm font-medium">
            <Link href="/" className="transition-colors hover:text-foreground/80 text-foreground/60">
              首页
            </Link>
            <Link href="/#download" className="transition-colors hover:text-foreground/80 text-foreground/60">
              下载 APK
            </Link>
            <Link href="/features" className="transition-colors hover:text-foreground/80 text-foreground/60">
              功能特性
            </Link>
            <Link href="/pricing" className="transition-colors hover:text-foreground/80 text-foreground/60">
              价格方案
            </Link>
          </nav>
        </div>

        <div className="flex items-center gap-4">
          <div className="hidden md:flex">
            {user ? (
              <div className="flex items-center gap-4">
                <Link href="/dash">
                  <Button variant="ghost">控制台</Button>
                </Link>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" className="relative h-8 w-8 rounded-full">
                      <Avatar className="h-8 w-8">
                        <AvatarImage src={user.user_metadata?.avatar_url} alt={user.email} />
                        <AvatarFallback>{user.email?.charAt(0).toUpperCase()}</AvatarFallback>
                      </Avatar>
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent className="w-56" align="end" forceMount>
                    <DropdownMenuLabel className="font-normal">
                      <div className="flex flex-col space-y-1">
                        <p className="text-sm font-medium leading-none">{user.user_metadata?.full_name || "用户"}</p>
                        <p className="text-xs leading-none text-muted-foreground">{user.email}</p>
                      </div>
                    </DropdownMenuLabel>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onSelect={() => router.push("/dash")}>控制台</DropdownMenuItem>
                    <DropdownMenuItem onSelect={() => router.push("/dash/post/account")}>个人设置</DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onSelect={handleSignOut}>退出登录</DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            ) : (
              <Link href="/auth/login">
                <Button>登录</Button>
              </Link>
            )}
          </div>

          <Sheet>
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon" className="md:hidden">
                <Menu className="h-5 w-5" />
                <span className="sr-only">Main menu</span>
              </Button>
            </SheetTrigger>
            <SheetContent side="right">
              <SheetHeader>
                <SheetTitle>GoMTM</SheetTitle>
              </SheetHeader>
              <div className="flex flex-col space-y-4 py-4">
                <Link href="/" className="font-medium hover:text-primary">
                  首页
                </Link>
                <Link href="/#download" className="font-medium hover:text-primary">
                  下载 APK
                </Link>
                <Link href="/features" className="font-medium hover:text-primary">
                  功能特性
                </Link>
                <Link href="/pricing" className="font-medium hover:text-primary">
                  价格方案
                </Link>
                {user ? (
                  <div className="flex flex-col space-y-2 pt-4 border-t">
                    <span className="text-sm text-muted-foreground">{user.email}</span>
                    <Link href="/dash">
                      <Button className="w-full">进入控制台</Button>
                    </Link>
                    <Button variant="outline" onClick={handleSignOut}>
                      退出登录
                    </Button>
                  </div>
                ) : (
                  <div className="flex flex-col space-y-2 pt-4 border-t">
                    <Link href="/auth/login">
                      <Button className="w-full">登录</Button>
                    </Link>
                    <Link href="/auth/register">
                      <Button variant="outline" className="w-full">
                        注册账号
                      </Button>
                    </Link>
                  </div>
                )}
              </div>
            </SheetContent>
          </Sheet>
        </div>
      </div>
    </header>
  );
}
