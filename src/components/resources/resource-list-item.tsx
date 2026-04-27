"use client";

import { HelpCircle, Terminal } from "lucide-react";
import type { ResourceListItem } from "mtmsdk/types/contracts";
import { cn } from "mtxuilib/lib/utils";
import { DebugValue, OnlyDebug } from "mtxuilib/mt/DebugValue";
import { Item, ItemContent, ItemDescription, ItemMedia, ItemTitle } from "mtxuilib/ui/item";
import Link from "next/link";
import { type ComponentType, useMemo } from "react";

export interface ListItemProps {
  item: ResourceListItem;
  compact?: boolean;
  onClick?: () => void;
}

function getResourceTitle(item: ResourceListItem) {
  return item.title?.trim() || "Untitled";
}

function getResourceDescription(item: ResourceListItem) {
  return item.description?.trim() || "";
}

export const CommonListItem = ({ item, compact, onClick }: ListItemProps) => {
  const ItemC: ComponentType<ListItemProps> = useMemo(() => {
    const type = item.type?.toLowerCase() || "unknown";
    switch (type) {
      case "worker":
        return ListItemWorker;
      default:
        return ListItemUnknown;
    }
  }, [item.type]);

  return <ItemC item={item} compact={compact} onClick={onClick} />;
};

const Wrapper = ({
  children,
  href,
  onClick,
  className,
}: {
  children: React.ReactNode;
  href: string;
  onClick?: () => void;
  className?: string;
}) => {
  if (onClick) {
    return (
      <div role="button" tabIndex={0} onClick={onClick} className={cn("cursor-pointer", className)}>
        {children}
      </div>
    );
  }

  return (
    <Link href={href} className={cn("cursor-pointer", className)}>
      {children}
    </Link>
  );
};

export const ListItemUnknown = ({ item, compact, onClick }: ListItemProps) => {
  const title = getResourceTitle(item);
  const description = getResourceDescription(item);

  return (
    <Item
      variant={compact ? undefined : "outline"}
      size={compact ? "sm" : "default"}
      className={cn(
        compact && "border-none shadow-none bg-transparent hover:bg-accent/50",
        onClick && "cursor-pointer",
      )}
      onClick={onClick}
    >
      <ItemMedia>
        <HelpCircle className="size-4 text-muted-foreground/50" />
      </ItemMedia>
      <ItemContent>
        <ItemTitle className={cn(compact && "text-sm")}>
          <span className="text-muted-foreground mr-2">[{item.type}]</span>
          {title}
        </ItemTitle>
        {!compact && <ItemDescription>{description}</ItemDescription>}
      </ItemContent>
      <OnlyDebug>
        <DebugValue data={item} />
      </OnlyDebug>
    </Item>
  );
};

export const ListItemWorker = ({ item, compact, onClick }: ListItemProps) => {
  const title = getResourceTitle(item);

  return (
    <Item
      variant={compact ? undefined : "outline"}
      size={compact ? "sm" : "default"}
      asChild
      className={cn(compact && "border-none shadow-none bg-transparent hover:bg-accent/50")}
    >
      <Wrapper href="#" onClick={onClick}>
        <ItemMedia>
          <Terminal className="size-4 text-blue-500" />
        </ItemMedia>
        <ItemContent>
          <ItemTitle className={cn("font-medium", compact && "text-sm")}>{title}</ItemTitle>
          <ItemDescription className={cn(compact && "text-xs truncate")}>
            {item.description?.trim() || "Active Sandbox"}
          </ItemDescription>
        </ItemContent>
      </Wrapper>
    </Item>
  );
};
