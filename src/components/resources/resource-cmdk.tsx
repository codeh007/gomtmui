"use client";

import { ArrowLeft, Check, ChevronsUpDown, Loader2, Plus, Search, X } from "lucide-react";
import { useRpcMutation } from "mtmsdk/supabase/use-sb-query/use-rpc-mutation";
import { useRpcQuery } from "mtmsdk/supabase/use-sb-query/use-rpc-query";
import type { ResourceListItem } from "mtmsdk/types/contracts";
import { cn } from "mtxuilib/lib/utils";
import { Button } from "mtxuilib/ui/button";
import { Command, CommandEmpty, CommandGroup, CommandItem, CommandList } from "mtxuilib/ui/command";
import { Dialog, DialogContent, DialogTitle, DialogTrigger } from "mtxuilib/ui/dialog";
import { Input } from "mtxuilib/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "mtxuilib/ui/popover";
import { Separator } from "mtxuilib/ui/separator";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { ListSkeleton } from "../common/list-skeleton";
import { CommonListItem } from "./resource-list-item";
import { getResourceComponent } from "./resource-registry";
import { zResourceListResult } from "./resource-schemas";
import { useResourcesStore } from "./resource-store";

interface ResourcesDlgProps {
  sessionId?: string;
}

export const ResourcesDlg = (props: ResourcesDlgProps) => {
  const open = useResourcesStore((x) => x.open);
  const setOpen = useResourcesStore((x) => x.setOpen);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className="text-muted-foreground gap-2 hidden md:flex h-8 bg-background/50"
          title="Manage Resources (CMD+K)"
        >
          <Search className="size-3.5" />
          <span className="text-xs">Resources</span>
          <kbd className="pointer-events-none inline-flex h-5 select-none items-center gap-1 rounded border bg-muted px-1.5 font-mono text-[10px] font-medium text-muted-foreground opacity-100">
            <span className="text-xs">⌘</span>K
          </kbd>
        </Button>
      </DialogTrigger>
      <DialogContent className="p-0 gap-0 max-w-2xl overflow-hidden shadow-2xl border-none">
        <DialogTitle className="sr-only">Resource Manager</DialogTitle>
        <ResourceManagerRoot sessionId={props.sessionId} onClose={() => setOpen(false)} />
      </DialogContent>
    </Dialog>
  );
};

const RESOURCE_TYPES = [
  { value: "worker", label: "Sandbox Workers" },
  { value: "browser", label: "Browsers" },
  { value: "proxy", label: "Proxies" },
  { value: "paccount", label: "Accounts" },
];

function ResourceManagerRoot({ sessionId, onClose }: { sessionId?: string; onClose: () => void }) {
  const viewMode = useResourcesStore((s) => s.viewMode);
  const backToList = useResourcesStore((s) => s.backToList);

  return (
    <div className="flex flex-col h-[60vh] md:h-[600px] w-full bg-background transition-all">
      {viewMode === "list" ? (
        <ResourceListView onClose={onClose} />
      ) : (
        <ResourceDetailView sessionId={sessionId} onBack={backToList} />
      )}
    </div>
  );
}

function ResourceListView(_props: { onClose: () => void }) {
  const searchKw = useResourcesStore((s) => s.searchKw);
  const selectedType = useResourcesStore((s) => s.selectedType);
  const setSearchKw = useResourcesStore((s) => s.setSearchKw);
  const setSelectedType = useResourcesStore((s) => s.setSelectedType);
  const openResourceForm = useResourcesStore((s) => s.openResourceForm);

  const [debouncedKw, setDebouncedKw] = useState(searchKw || "");
  const [typeOpen, setTypeOpen] = useState(false);

  useEffect(() => {
    setDebouncedKw(searchKw || "");
  }, [searchKw]);

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedKw(searchKw || ""), 300);
    return () => clearTimeout(timer);
  }, [searchKw]);

  const {
    data: items,
    isLoading,
    isFetching,
  } = useRpcQuery(
    "resource_list",
    {
      p_kw: debouncedKw,
      p_type: selectedType,
      p_page_size: 50,
    },
    {
      schema: zResourceListResult,
    },
  );

  const handleSelectType = (val: string) => {
    setSelectedType(val === selectedType ? "" : val);
    setTypeOpen(false);
  };

  const activeTypeLabel = RESOURCE_TYPES.find((t) => t.value === selectedType)?.label || "All Types";

  return (
    <>
      <div className="flex items-center border-b px-3 py-2 gap-2 shrink-0 bg-muted/5">
        <Popover open={typeOpen} onOpenChange={setTypeOpen}>
          <PopoverTrigger asChild>
            <Button
              variant="outline"
              role="combobox"
              size="sm"
              aria-expanded={typeOpen}
              className="w-[160px] justify-between h-8 text-xs shrink-0 bg-background"
            >
              {activeTypeLabel}
              <ChevronsUpDown className="ml-2 h-3 w-3 shrink-0 opacity-50" />
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-[180px] p-0" align="start">
            <Command>
              <CommandList>
                <CommandGroup>
                  <CommandItem onSelect={() => handleSelectType("")} className="text-xs">
                    <Check className={cn("mr-2 h-3 w-3", selectedType === "" ? "opacity-100" : "opacity-0")} />
                    All Types
                  </CommandItem>
                  {RESOURCE_TYPES.map((type) => (
                    <CommandItem key={type.value} onSelect={() => handleSelectType(type.value)} className="text-xs">
                      <Check
                        className={cn("mr-2 h-3 w-3", selectedType === type.value ? "opacity-100" : "opacity-0")}
                      />
                      {type.label}
                    </CommandItem>
                  ))}
                </CommandGroup>
              </CommandList>
            </Command>
          </PopoverContent>
        </Popover>

        <Separator orientation="vertical" className="h-6" />

        <div className="flex-1 relative group">
          <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground opacity-50 group-focus-within:text-primary group-focus-within:opacity-100 transition-all" />
          <Input
            className="flex h-9 w-full rounded-md bg-transparent px-3 pl-8 py-1 text-sm shadow-none border-none focus-visible:ring-0 focus-visible:bg-accent/20 transition-colors file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground disabled:cursor-not-allowed disabled:opacity-50"
            placeholder="Search resources..."
            value={searchKw || ""}
            onChange={(e) => setSearchKw(e.target.value)}
            autoFocus
          />
          {searchKw && (
            <Button
              variant="ghost"
              onClick={() => setSearchKw("")}
              className="absolute right-1 top-1/2 -translate-y-1/2 rounded-full h-6 w-6 p-0 hover:bg-muted"
            >
              <X className="h-3 w-3 text-muted-foreground" />
            </Button>
          )}
        </div>

        {selectedType && (
          <Button size="sm" className="h-8 text-xs gap-1" onClick={() => openResourceForm(selectedType)}>
            <Plus className="size-3.5" />
            New
          </Button>
        )}
      </div>

      <Command className="flex-1 overflow-hidden bg-transparent" shouldFilter={false}>
        <CommandList className="h-full max-h-full overflow-y-auto py-2 px-2 space-y-1 scrollbar-thin">
          {isFetching && items?.length !== 0 && (
            <div className="absolute top-2 right-4 z-10">
              <Loader2 className="h-4 w-4 animate-spin text-primary/50" />
            </div>
          )}

          {isLoading && !items && (
            <div className="p-2">
              <ListSkeleton count={8} showMedia={true} />
            </div>
          )}

          {items?.length === 0 && !isLoading && (
            <div className="flex flex-col items-center justify-center h-64 gap-3 text-muted-foreground">
              <CommandEmpty className="text-sm">No resources found.</CommandEmpty>
              {selectedType && (
                <Button variant="outline" size="sm" onClick={() => openResourceForm(selectedType)}>
                  <Plus className="mr-2 h-3.5 w-3.5" />
                  Create new {activeTypeLabel}
                </Button>
              )}
            </div>
          )}

          {items && items.length > 0 && (
            <CommandGroup heading="Available Resources">
              {items.map((item) => (
                <CommandItem
                  key={item.id}
                  value={item.id + item.title}
                  className="px-2 py-1 aria-selected:bg-accent cursor-pointer rounded-md relative group"
                  onSelect={() => {
                    openResourceForm(item.type, item.target_id || item.id);
                  }}
                >
                  <div className="w-full pointer-events-none">
                    <CommonListItem
                      item={item as unknown as ResourceListItem}
                      compact
                      onClick={() => {}} // Pass generic handler to disable Link in Wrapper
                    />
                  </div>
                </CommandItem>
              ))}
            </CommandGroup>
          )}
        </CommandList>

        <div className="p-2 border-t bg-muted/5 text-[10px] text-muted-foreground flex justify-between px-4 shrink-0">
          <span>{items?.length || 0} items</span>
          <div className="flex gap-2">
            <span>Server Search</span>
            {selectedType && <span className="font-medium">Filter: {selectedType}</span>}
          </div>
        </div>
      </Command>
    </>
  );
}

function ResourceDetailView({ sessionId, onBack }: { sessionId?: string; onBack: () => void }) {
  const resourceType = useResourcesStore((s) => s.formResourceType);
  const resourceId = useResourcesStore((s) => s.formResourceId);

  const ResourceContainer = getResourceComponent(resourceType || "");

  const signalWakeupMutation = useRpcMutation("agent_signal_wakeup", {
    onError: (error) => {
      console.error("Signal wakeup failed", error);
    },
  });

  const handleSuccess = () => {
    toast.success("Saved successfully");
    onBack();
    if (sessionId) {
      signalWakeupMutation.mutate(
        { p_session_id: sessionId },
        {
          onSuccess: (result) => {
            if (!result.error) {
              toast.success("Agent notified of update");
            }
          },
        },
      );
    }
  };

  return (
    <div className="flex flex-col h-full bg-background animate-in slide-in-from-right-4 duration-300">
      <div className="flex items-center border-b px-4 py-3 shrink-0 gap-2 bg-muted/10">
        <Button variant="ghost" size="icon" className="h-8 w-8 -ml-2" onClick={onBack}>
          <ArrowLeft className="size-4" />
        </Button>
        <div className="flex flex-col">
          <span className="text-sm font-semibold">{resourceId ? "Edit Resource" : "New Resource"}</span>
          <span className="text-[10px] text-muted-foreground font-mono uppercase">
            {resourceType} {resourceId ? `• ${resourceId.slice(0, 8)}` : ""}
          </span>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4 md:p-6">
        <ResourceContainer resourceId={resourceId} onSuccess={handleSuccess} onCancel={onBack} />
      </div>
    </div>
  );
}
