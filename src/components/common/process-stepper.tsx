import { Check } from "lucide-react";
import { cn } from "mtxuilib/lib/utils";
import * as React from "react";

export interface ProcessStep {
  id: string;
  title: string;
  description?: React.ReactNode;
  status: "complete" | "current" | "upcoming" | "error";
  errorReason?: string;
}

export function ProcessStepper({ steps, className }: { steps: ProcessStep[]; className?: string }) {
  return (
    <nav aria-label="Progress" className={cn("px-2 py-4", className)}>
      <ol className="overflow-hidden">
        {steps.map((step, stepIdx) => (
          <li key={step.id} className={cn("relative", stepIdx !== steps.length - 1 ? "pb-8" : "")}>
            {stepIdx !== steps.length - 1 ? (
              <div
                className={cn(
                  "absolute left-4 top-4 -ml-px h-full w-0.5",
                  step.status === "complete" ? "bg-primary" : "bg-muted",
                  step.status === "error" ? "bg-destructive/30" : "",
                )}
                aria-hidden="true"
              />
            ) : null}
            <div className="relative flex items-start group">
              <span className="h-9 flex items-center">
                <span
                  className={cn(
                    "relative z-10 w-8 h-8 flex items-center justify-center bg-background rounded-full border-2 transition-colors",
                    step.status === "complete"
                      ? "border-primary bg-primary"
                      : step.status === "current"
                        ? "border-primary"
                        : step.status === "error"
                          ? "border-destructive bg-destructive/10"
                          : "border-muted group-hover:border-muted-foreground",
                  )}
                >
                  {step.status === "complete" ? (
                    <Check className="w-5 h-5 text-primary-foreground" />
                  ) : step.status === "error" ? (
                    <span className="w-2.5 h-2.5 bg-destructive rounded-full" />
                  ) : step.status === "current" ? (
                    <span className="w-2.5 h-2.5 bg-primary rounded-full animate-pulse" />
                  ) : (
                    <span className="w-2.5 h-2.5 bg-transparent rounded-full group-hover:bg-muted" />
                  )}
                </span>
              </span>
              <span className="ml-4 min-w-0 flex flex-col justify-center min-h-[36px]">
                <span
                  className={cn(
                    "text-sm font-semibold tracking-wide",
                    step.status === "complete"
                      ? "text-primary"
                      : step.status === "current"
                        ? "text-primary font-bold"
                        : step.status === "error"
                          ? "text-destructive"
                          : "text-muted-foreground",
                  )}
                >
                  {step.title}
                </span>
                {step.description && <div className="text-sm text-muted-foreground mt-1">{step.description}</div>}
                {step.errorReason && (
                  <div className="text-sm text-destructive font-medium mt-1">{step.errorReason}</div>
                )}
              </span>
            </div>
          </li>
        ))}
      </ol>
    </nav>
  );
}
