import { useToast } from "mtxuilib/hooks/useToast";
import { useCallback } from "react";
import { type AppError, logError, normalizeError } from "../lib/error-utils";

export interface ErrorHandlerOptions {
  /**
   * Custom title for the error toast. Default: "Error"
   */
  title?: string;
  /**
   * Fallback message if the error object doesn't have a meaningful message.
   * Default: "An unexpected error occurred."
   */
  fallbackMessage?: string;
  /**
   * If true, the error will only be logged to console/Sentry but not shown in UI.
   */
  silent?: boolean;
  /**
   * Whether to re-throw the error after handling. Default: false
   */
  shouldThrow?: boolean;
  /**
   * Context string for logging purposes.
   */
  context?: string;
}

/**
 * A hook to provide a standardized way to handle errors in the UI.
 * Integrates with Toast for user feedback and console/Sentry for logging.
 */
export function useErrorHandler() {
  const { toast } = useToast();

  const handleError = useCallback(
    (error: unknown, options: ErrorHandlerOptions = {}) => {
      const {
        title = "Error",
        fallbackMessage = "An unexpected error occurred.",
        silent = false,
        shouldThrow = false,
        context,
      } = options;

      const appError: AppError = normalizeError(error, fallbackMessage);

      // Log error (Console / Sentry placeholder)
      logError(appError, context);

      // UI Feedback
      if (!silent) {
        toast({
          title: title,
          description: appError.message,
          variant: "destructive",
        });
      }

      // Rethrow if requested
      if (shouldThrow) {
        throw error;
      }
    },
    [toast],
  );

  return { handleError };
}
