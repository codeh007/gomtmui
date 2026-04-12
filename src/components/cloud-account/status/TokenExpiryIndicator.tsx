"use client";

import { differenceInMinutes, formatDistanceToNow, isPast, parseISO } from "date-fns";
import { AlertCircle, Clock, RefreshCw } from "lucide-react";
import { useEffect, useState } from "react";
import type { CloudAccount } from "../schemas";

interface TokenExpiryIndicatorProps {
  account: CloudAccount;
}

/**
 * Component to display the time remaining before a cloud account token expires.
 * It also shows status updates for expired or currently refreshing tokens.
 */
export function TokenExpiryIndicator({ account }: TokenExpiryIndicatorProps) {
  const [now, setNow] = useState(new Date());

  useEffect(() => {
    // Update the local "now" time every minute to refresh the countdown
    const timer = setInterval(() => setNow(new Date()), 60000);
    return () => clearInterval(timer);
  }, []);

  // If no expiry date is set, or the account is manual/disabled, don't show the indicator
  if (!account.token_expires_at || account.status === "disabled") {
    return null;
  }

  const expiryDate = parseISO(account.token_expires_at);
  const expired = isPast(expiryDate);
  const minutesLeft = differenceInMinutes(expiryDate, now);

  // Expired state
  if (expired) {
    if (account.status === "token_expired") {
      return (
        <div className="flex items-center gap-1.5 text-[10px] font-medium text-yellow-600 dark:text-yellow-400 animate-pulse">
          <RefreshCw className="h-3 w-3 animate-spin" />
          <span>Token expired, refreshing...</span>
        </div>
      );
    }
    if (account.status === "needs_reauth") {
      return (
        <div className="flex items-center gap-1.5 text-[10px] font-medium text-orange-600 dark:text-orange-400">
          <AlertCircle className="h-3 w-3" />
          <span>Expired - Re-authentication required</span>
        </div>
      );
    }
    // Generic expired state
    return (
      <div className="flex items-center gap-1.5 text-[10px] font-medium text-destructive">
        <AlertCircle className="h-3 w-3" />
        <span>Token expired</span>
      </div>
    );
  }

  // Not expired yet
  // Show warning if less than 1 hour (60 minutes)
  const isWarning = minutesLeft < 60;
  const isCritical = minutesLeft < 15;

  return (
    <div
      className={`flex items-center gap-1.5 text-[10px] font-medium transition-colors ${
        isCritical ? "text-red-500 animate-pulse" : isWarning ? "text-amber-500" : "text-muted-foreground/70"
      }`}
    >
      {isWarning ? <AlertCircle className="h-3 w-3" /> : <Clock className="h-3 w-3" />}
      <span>Expires {formatDistanceToNow(expiryDate, { addSuffix: true })}</span>
    </div>
  );
}
