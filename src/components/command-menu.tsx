"use client";

import { Home, Laptop, Monitor, Moon, Settings, Sun, Tag } from "lucide-react";
import { useRpcQuery } from "mtmsdk/supabase/use-sb-query/use-rpc-query";
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from "mtxuilib/ui/command";
import { useRouter } from "next/navigation";
import { useTheme } from "next-themes";
import * as React from "react";
import { z } from "zod";
import { useCurrentUserRole } from "@/hooks/use-current-user-role";
import { useServerInstanceListInfinite } from "./server-instance/hooks";

export function CommandMenu() {
  const [open, setOpen] = React.useState(false);
  const [selectedTagId, setSelectedTagId] = React.useState<string | null>(null);
  const router = useRouter();
  const { setTheme } = useTheme();
  const { isAdmin } = useCurrentUserRole();

  const { data: tagsData } = useRpcQuery(
    "tag_list",
    {},
    {
      enabled: open,
      schema: z.array(
        z
          .object({
            id: z.string(),
            name: z.string(),
            color: z.string().nullable().optional(),
            instance_count: z.number().nullable().optional(),
          })
          .loose(),
      ),
    },
  );
  const tags = tagsData || [];

  const { data } = useServerInstanceListInfinite({
    pageSize: 50,
    enabled: open && isAdmin,
    poll: false,
  });
  const instances = data?.pages.flat() || [];

  const selectedTag = selectedTagId ? tags.find((t) => t.id === selectedTagId) : null;

  React.useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === "k" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setOpen((open) => !open);
      }
    };

    document.addEventListener("keydown", down);
    return () => document.removeEventListener("keydown", down);
  }, []);

  React.useEffect(() => {
    if (!open) {
      setSelectedTagId(null);
    }
  }, [open]);

  const runCommand = React.useCallback((command: () => unknown) => {
    setOpen(false);
    command();
  }, []);

  return (
    <CommandDialog open={open} onOpenChange={setOpen}>
      <CommandInput placeholder={selectedTag ? `在 [${selectedTag.name}] 标签下搜索...` : "输入命令或搜索..."} />
      <CommandList>
        <CommandEmpty>未找到结果</CommandEmpty>

        {selectedTag && (
          <CommandGroup heading="当前过滤">
            <CommandItem onSelect={() => setSelectedTagId(null)} className="gap-2">
              <div className="h-3 w-3 rounded-full" style={{ backgroundColor: selectedTag.color || "#6366f1" }} />
              <span className="flex-1">{selectedTag.name}</span>
              <span className="text-xs text-muted-foreground">点击清除</span>
            </CommandItem>
          </CommandGroup>
        )}

        <CommandGroup heading="快捷导航">
          <CommandItem onSelect={() => runCommand(() => router.push("/dash"))}>
            <Home className="mr-2 h-4 w-4" />
            <span>控制台首页</span>
          </CommandItem>
          <CommandItem onSelect={() => runCommand(() => router.push("/dash/hermes"))}>
            <Home className="mr-2 h-4 w-4" />
            <span>Hermes 工作台</span>
          </CommandItem>
          {isAdmin && (
            <CommandItem onSelect={() => runCommand(() => router.push("/dash/instances"))}>
              <Monitor className="mr-2 h-4 w-4" />
              <span>服务实例列表</span>
            </CommandItem>
          )}
          <CommandItem onSelect={() => runCommand(() => router.push("/dash/settings"))}>
            <Settings className="mr-2 h-4 w-4" />
            <span>系统设置</span>
          </CommandItem>
        </CommandGroup>

        <CommandSeparator />

        {tags.length > 0 && !selectedTagId && (
          <>
            <CommandGroup heading="按标签过滤">
              {tags.slice(0, 8).map((tag) => (
                <CommandItem
                  key={tag.id}
                  value={`tag:${tag.name}`}
                  onSelect={() => setSelectedTagId(tag.id)}
                  className="gap-2"
                >
                  <Tag className="h-4 w-4" />
                  <div className="h-3 w-3 rounded-full" style={{ backgroundColor: tag.color || "#6366f1" }} />
                  <span>{tag.name}</span>
                  {tag.instance_count != null && (
                    <span className="text-xs text-muted-foreground ml-auto">{tag.instance_count} 个实例</span>
                  )}
                </CommandItem>
              ))}
            </CommandGroup>
            <CommandSeparator />
          </>
        )}

        {isAdmin && (
          <>
            <CommandGroup heading={selectedTag ? `标签 [${selectedTag.name}] 下的实例` : "服务实例"}>
              {instances.map((instance) => (
                <CommandItem
                  key={instance.id}
                  onSelect={() => runCommand(() => router.push(`/dash/instances`))}
                  value={instance.id ?? ""}
                >
                  <Monitor className="mr-2 h-4 w-4" />
                  <span>{instance.id?.substring(0, 8) || "Unknown"}</span>
                </CommandItem>
              ))}
              {instances.length === 0 && (
                <div className="px-2 py-1.5 text-sm text-muted-foreground">
                  {selectedTag ? "该标签下没有实例" : "暂无实例"}
                </div>
              )}
            </CommandGroup>

            <CommandSeparator />
          </>
        )}

        <CommandGroup heading="主题">
          <CommandItem onSelect={() => runCommand(() => setTheme("light"))}>
            <Sun className="mr-2 h-4 w-4" />
            <span>浅色模式</span>
          </CommandItem>
          <CommandItem onSelect={() => runCommand(() => setTheme("dark"))}>
            <Moon className="mr-2 h-4 w-4" />
            <span>深色模式</span>
          </CommandItem>
          <CommandItem onSelect={() => runCommand(() => setTheme("system"))}>
            <Laptop className="mr-2 h-4 w-4" />
            <span>跟随系统</span>
          </CommandItem>
        </CommandGroup>
      </CommandList>
    </CommandDialog>
  );
}
