"use client";

import { Trash2 } from "lucide-react";
import { Button } from "mtxuilib/ui/button";
import { DialogTrigger } from "mtxuilib/ui/dialog";
import { Item, ItemActions, ItemContent, ItemTitle } from "mtxuilib/ui/item";
import Link from "next/link";

interface HistoryItem {
  id: string;
  title: string;
}

interface HistoryItemProps {
  item: HistoryItem;
  onDelete?: (event: React.UIEvent) => void;
}

export function HistoryItem({ item, onDelete }: HistoryItemProps) {
  return (
    <Item variant="muted" className="transition-all group">
      <ItemContent>
        <div className="flex items-center justify-between w-full">
          <ItemTitle className="flex-1">
            <Link href={`/chat/${item.id}`} className="truncate block hover:underline">
              {item.title}
            </Link>
          </ItemTitle>

          <ItemActions className="opacity-0 group-hover:opacity-100 transition-opacity">
            <DialogTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                className="text-destructive hover:text-destructive"
                onClick={(event) => {
                  event.preventDefault();
                  onDelete?.(event);
                }}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </DialogTrigger>
          </ItemActions>
        </div>
      </ItemContent>
    </Item>
  );
}
