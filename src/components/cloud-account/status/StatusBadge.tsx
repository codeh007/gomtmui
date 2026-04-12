"use client";

import { AlertCircle, AlertTriangle, Ban, CheckCircle2, Clock, HelpCircle, PauseCircle } from "lucide-react";
import { cn } from "mtxuilib/lib/utils";
import { Badge } from "mtxuilib/ui/badge";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "mtxuilib/ui/tooltip";
import type { CloudAccountStatus } from "../schemas";

interface StatusBadgeProps {
  status: CloudAccountStatus | undefined | null;
  reason?: string | null;
  className?: string;
}

export function StatusBadge({ status, reason, className }: StatusBadgeProps) {
  const statusConfig = getStatusConfig(status);

  const badge = (
    <Badge variant="outline" className={cn("gap-1.5 pr-2.5 font-medium capitalize", statusConfig.color, className)}>
      <statusConfig.icon className="h-3.5 w-3.5" />
      {status?.replace(/_/g, " ") || "Unknown"}
    </Badge>
  );

  if (reason) {
    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>{badge}</TooltipTrigger>
          <TooltipContent>
            <p>{reason}</p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  }

  return badge;
}

function getStatusConfig(status: CloudAccountStatus | undefined | null) {
  switch (status) {
    case "active":
      return {
        icon: CheckCircle2,
        color:
          "border-green-200 bg-green-50 text-green-700 dark:border-green-800 dark:bg-green-950/30 dark:text-green-400",
      };
    case "token_expired":
      return {
        icon: Clock,
        color:
          "border-yellow-200 bg-yellow-50 text-yellow-700 dark:border-yellow-800 dark:bg-yellow-950/30 dark:text-yellow-400",
      };
    case "needs_reauth":
      return {
        icon: AlertTriangle,
        color:
          "border-orange-200 bg-orange-50 text-orange-700 dark:border-orange-800 dark:bg-orange-950/30 dark:text-orange-400",
      };
    case "quota_exceeded":
      return {
        icon: AlertCircle,
        color: "border-red-200 bg-red-50 text-red-700 dark:border-red-800 dark:bg-red-950/30 dark:text-red-400",
      };
    case "suspended":
      return {
        icon: Ban,
        color: "border-red-200 bg-red-50 text-red-700 dark:border-red-800 dark:bg-red-950/30 dark:text-red-400",
      };
    case "disabled":
      return {
        icon: PauseCircle,
        color: "border-zinc-200 bg-zinc-50 text-zinc-700 dark:border-zinc-800 dark:bg-zinc-950/30 dark:text-zinc-400",
      };
    case "pending":
    default:
      return {
        icon: HelpCircle,
        color: "border-zinc-200 bg-zinc-50 text-zinc-700 dark:border-zinc-800 dark:bg-zinc-950/30 dark:text-zinc-400",
      };
  }
}
