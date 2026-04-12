import { useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { Loader2, RotateCcw, Trash2 } from "lucide-react";
import { useRpcMutation } from "mtmsdk/supabase/use-sb-query/use-rpc-mutation";
import { getRpcQueryKey } from "mtmsdk/supabase/use-sb-query/use-rpc-query";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "mtxuilib/ui/alert-dialog";
import { Button } from "mtxuilib/ui/button";
import { ScrollArea } from "mtxuilib/ui/scroll-area";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "mtxuilib/ui/table";
import { Tooltip, TooltipContent, TooltipTrigger } from "mtxuilib/ui/tooltip";
import { useMemo } from "react";
import { toast } from "sonner";
import z from "zod";
import { DeviceHistoryItemSchema } from "../schemas";

interface DeviceHistoryListProps {
  accountId: string;
  history: unknown[]; // We will parse this with Zod
}

export function DeviceHistoryList({ accountId, history }: DeviceHistoryListProps) {
  const queryClient = useQueryClient();

  const restoreMutation = useRpcMutation("cloud_account_device_restore", {
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: getRpcQueryKey("cloud_account_get") });
      void queryClient.invalidateQueries({ queryKey: getRpcQueryKey("cloud_account_list_cursor") });
      toast.success("历史版本已恢复");
    },
    onError: (err) => {
      toast.error(`恢复失败: ${err.message}`);
    },
  });

  const deleteMutation = useRpcMutation("cloud_account_device_delete_version", {
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: getRpcQueryKey("cloud_account_get") });
      toast.success("历史版本已删除");
    },
    onError: (err) => {
      toast.error(`删除失败: ${err.message}`);
    },
  });

  // Parse and sort history (newest first)
  const sortedHistory = useMemo(() => {
    if (!history) return [];
    try {
      const parsed = z.array(DeviceHistoryItemSchema).parse(history);
      return parsed.sort((a, b) => (b.created_at || 0) - (a.created_at || 0));
    } catch (e) {
      console.error("Failed to parse device history", e);
      return [];
    }
  }, [history]);

  if (sortedHistory.length === 0) {
    return <div className="text-sm text-muted-foreground py-4">No history available.</div>;
  }

  const handleRestore = (versionId: string) => {
    restoreMutation.mutate({ p_id: accountId, p_version_id: versionId });
  };

  const handleDelete = (versionId: string) => {
    deleteMutation.mutate({ p_account_id: accountId, p_version: Number.parseInt(versionId, 10) });
  };

  return (
    <ScrollArea className="h-[300px] w-full border rounded-md">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Date</TableHead>
            <TableHead>Label</TableHead>
            <TableHead>Profile ID</TableHead>
            <TableHead className="text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {sortedHistory.map((item) => (
            <TableRow key={item.id}>
              <TableCell className="font-medium">
                {item.created_at ? format(new Date(item.created_at * 1000), "yyyy-MM-dd HH:mm") : "-"}
              </TableCell>
              <TableCell>{item.label || "Auto Backup"}</TableCell>
              <TableCell className="font-mono text-xs">
                {/* Display a snippet of the profile or its ID */}
                <Tooltip>
                  <TooltipTrigger className="cursor-help underline decoration-dotted">
                    {item.profile ? "View Profile" : "Empty"}
                  </TooltipTrigger>
                  <TooltipContent className="max-w-[300px] break-all">
                    <pre className="text-xs whitespace-pre-wrap">{JSON.stringify(item.profile, null, 2)}</pre>
                  </TooltipContent>
                </Tooltip>
              </TableCell>
              <TableCell className="text-right space-x-2">
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => handleRestore(item.id)}
                  disabled={restoreMutation.isPending}
                  title="Restore this version"
                >
                  {restoreMutation.isPending ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <RotateCcw className="h-4 w-4 text-primary" />
                  )}
                </Button>

                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button variant="ghost" size="icon" disabled={deleteMutation.isPending} title="Delete this version">
                      {deleteMutation.isPending ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Trash2 className="h-4 w-4 text-destructive" />
                      )}
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Are you sure?</AlertDialogTitle>
                      <AlertDialogDescription>
                        This action cannot be undone. This will permanently delete this device profile version from
                        history.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancel</AlertDialogCancel>
                      <AlertDialogAction
                        onClick={() => handleDelete(item.id)}
                        className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                      >
                        Delete
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </ScrollArea>
  );
}
