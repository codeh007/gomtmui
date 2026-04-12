import { useQueryClient } from "@tanstack/react-query";
import { formatDistanceToNow } from "date-fns";
import { Fingerprint, MoreHorizontal, Power, RefreshCw, Trash2 } from "lucide-react";
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
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "mtxuilib/ui/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "mtxuilib/ui/dropdown-menu";
import Link from "next/link";
import { useState } from "react";
import { getPlatformIcon } from "@/components/cloud-account/platform-icons";
import { useErrorHandler } from "@/hooks/use-error-handler";
import type { CloudAccount } from "./schemas";
import { StatusBadge } from "./status/StatusBadge";
import { TokenExpiryIndicator } from "./status/TokenExpiryIndicator";

interface CloudAccountCardProps {
  account: CloudAccount;
  onReauth?: (account: CloudAccount) => void;
  onDeviceProfile?: (account: CloudAccount) => void;
}

export function CloudAccountCard({ account, onReauth, onDeviceProfile }: CloudAccountCardProps) {
  const { handleError } = useErrorHandler();
  const queryClient = useQueryClient();

  const upsertMutation = useRpcMutation("cloud_account_upsert", {
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: getRpcQueryKey("cloud_account_list_cursor") });
      void queryClient.invalidateQueries({ queryKey: getRpcQueryKey("cloud_account_get") });
    },
  });

  const deleteMutation = useRpcMutation("cloud_account_delete", {
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: getRpcQueryKey("cloud_account_list_cursor") });
      void queryClient.invalidateQueries({ queryKey: getRpcQueryKey("cloud_account_get") });
    },
  });

  const [isDeleting, setIsDeleting] = useState(false);

  const PlatformIconComponent = getPlatformIcon(account.platform_name);
  const isEnabled = account.status !== "disabled";

  const handleToggleStatus = async () => {
    const newStatus = isEnabled ? "disabled" : "active";
    try {
      await upsertMutation.mutateAsync({
        p_id: account.id,
        p_status: newStatus,
        p_platform_name: account.platform_name,
      });
    } catch (error: unknown) {
      handleError(error, {
        title: "Error",
        fallbackMessage: "Failed to update status",
      });
    }
  };

  const handleDelete = async () => {
    try {
      setIsDeleting(true);
      await deleteMutation.mutateAsync({ p_id: account.id });
    } catch (error: unknown) {
      handleError(error, {
        title: "Delete Failed",
        fallbackMessage: "Failed to delete account",
      });
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <Card className="flex flex-col h-full bg-card hover:bg-accent/5 transition-colors">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 gap-2">
        <div className="flex items-center gap-3 overflow-hidden flex-1">
          <Link
            href={`/dash/cloud-accounts/${account.platform_name}/${account.id}`}
            className="flex items-center gap-3 overflow-hidden flex-1 hover:opacity-80 transition-opacity"
          >
            <div className="flex items-center justify-center p-2 rounded-md bg-muted/50 border">
              <PlatformIconComponent className="h-6 w-6 text-muted-foreground/80" />
            </div>
            <div className="flex flex-col overflow-hidden">
              <CardTitle className="text-base font-semibold truncate">
                {account.account_name || account.account_email || "Unnamed Account"}
              </CardTitle>
              <CardDescription className="text-xs truncate">
                {account.platform_name}
                {account.account_email && ` • ${account.account_email}`}
              </CardDescription>
            </div>
          </Link>
        </div>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="-mr-2 h-8 w-8 text-muted-foreground/50 hover:text-foreground"
            >
              <MoreHorizontal className="h-4 w-4" />
              <span className="sr-only">Menu</span>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            {onDeviceProfile && (
              <DropdownMenuItem onClick={() => onDeviceProfile(account)}>
                <Fingerprint className="mr-2 h-4 w-4" />
                Device Profile
              </DropdownMenuItem>
            )}
            {(account.status === "needs_reauth" || account.status === "token_expired") && onReauth && (
              <DropdownMenuItem onClick={() => onReauth(account)} className="text-amber-600 focus:text-amber-600">
                <RefreshCw className="mr-2 h-4 w-4" />
                Re-authenticate
              </DropdownMenuItem>
            )}
            <DropdownMenuItem onClick={handleToggleStatus}>
              <Power className="mr-2 h-4 w-4" />
              {isEnabled ? "Disable" : "Enable"}
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <DropdownMenuItem onSelect={(e) => e.preventDefault()} className="text-red-600 focus:text-red-600">
                  <Trash2 className="mr-2 h-4 w-4" />
                  Delete
                </DropdownMenuItem>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
                  <AlertDialogDescription>
                    This action cannot be undone. This will permanently delete the account and remove your data from our
                    servers.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction
                    onClick={handleDelete}
                    className="bg-red-600 hover:bg-red-700"
                    disabled={isDeleting}
                  >
                    {isDeleting ? "Deleting..." : "Delete"}
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </DropdownMenuContent>
        </DropdownMenu>
      </CardHeader>

      <CardContent className="flex-1 pb-2">
        <div className="flex flex-wrap gap-2 mt-2">
          <StatusBadge status={account.status} reason={account.status_reason} />
        </div>
      </CardContent>

      <CardFooter className="pt-2 pb-4 text-xs text-muted-foreground border-t bg-muted/10 mt-auto">
        <div className="flex justify-between w-full items-center">
          <span>
            {account.last_used_at
              ? `Last used ${formatDistanceToNow(new Date(account.last_used_at), { addSuffix: true })}`
              : "Never used"}
          </span>
          <TokenExpiryIndicator account={account} />
          {/* Add more footer info if needed, e.g. quota */}
        </div>
      </CardFooter>
    </Card>
  );
}
