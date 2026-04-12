export interface AppError {
  message: string;
  originalError: unknown;
  code?: string;
}

export function normalizeError(error: unknown, fallbackMessage = "An unexpected error occurred."): AppError {
  let message = fallbackMessage;
  let code: string | undefined;

  if (error instanceof Error) {
    message = error.message;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    code = (error as any).code;
  } else if (typeof error === "string") {
    message = error;
  } else if (error && typeof error === "object" && "message" in error) {
    message = String((error as { message: unknown }).message);
  }

  return {
    message,
    originalError: error,
    code,
  };
}

export function logError(error: AppError, context?: string) {
  const prefix = context ? `[${context}]` : "[Error]";
  console.error(`${prefix} ${error.message}`, error.originalError);

  // Placeholder for Sentry integration
  // if (typeof window !== 'undefined' && (window as any).Sentry) {
  //   (window as any).Sentry.captureException(error.originalError);
  // }
}
