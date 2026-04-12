"use client";

import { AlertTriangle, RefreshCw } from "lucide-react";
import { Button } from "mtxuilib/ui/button";
import { Component, type ErrorInfo, type ReactNode } from "react";
import { normalizeError } from "@/lib/error-utils";

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
  name?: string; // Component name for debugging
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error(`ErrorBoundary [${this.props.name || "Unknown"}] caught error:`, error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <div className="flex flex-col items-center justify-center p-6 border rounded-lg bg-destructive/5 text-destructive border-destructive/20 min-h-[150px]">
          <AlertTriangle className="h-8 w-8 mb-3 opacity-80" />
          <h3 className="font-medium text-lg mb-1">Failed to render component</h3>
          {this.props.name && <p className="text-sm font-mono opacity-80 mb-2">[{this.props.name}]</p>}
          <p className="text-sm text-center opacity-80 max-w-md wrap-break-word mb-4">
            {normalizeError(this.state.error).message}
          </p>
          <Button
            variant="outline"
            size="sm"
            className="gap-2 border-destructive/30 hover:bg-destructive/10 hover:text-destructive"
            onClick={() => {
              this.setState({ hasError: false, error: null });
              // Optional: window.location.reload(); if deep reset needed, but ideally we just reset state
            }}
          >
            <RefreshCw className="h-4 w-4" />
            Retry
          </Button>
        </div>
      );
    }

    return this.props.children;
  }
}
