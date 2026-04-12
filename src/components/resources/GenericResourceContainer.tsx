"use client";

import { Loader2 } from "lucide-react";
import { useRpcQuery } from "mtmsdk/supabase/use-sb-query/use-rpc-query";
import { DebugValue } from "mtxuilib/mt/DebugValue";
import { Button } from "mtxuilib/ui/button";
import type { ResourceViewProps } from "./resource-registry";
import { zResourceDetail } from "./resource-schemas";

export function GenericResourceContainer({ resourceId, onCancel }: ResourceViewProps) {
  const { data, error, isLoading } = useRpcQuery(
    "resource_get",
    { p_resource_id: resourceId || "" },
    {
      enabled: !!resourceId,
      refetchOnWindowFocus: false,
      schema: zResourceDetail,
    },
  );

  if (!resourceId) {
    return (
      <div className="p-6 text-center text-muted-foreground space-y-4">
        <p>Creating generic resources is not supported in this view yet.</p>
        <Button variant="outline" onClick={onCancel}>
          Go Back
        </Button>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Loader2 className="animate-spin text-muted-foreground size-8" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-4 border border-destructive/20 bg-destructive/5 rounded text-destructive text-sm m-4">
        Error: {error.message}
      </div>
    );
  }

  return (
    <div className="p-4 space-y-4">
      <div className="bg-yellow-500/10 border border-yellow-500/20 p-3 rounded text-yellow-600 text-xs">
        No specific form implementation found for this resource type. Showing generic data.
      </div>
      <div className="border rounded-md p-2 bg-muted/10">
        <DebugValue data={data} title="Raw Resource Data" />
      </div>
      <div className="flex justify-end">
        <Button variant="secondary" onClick={onCancel}>
          Close
        </Button>
      </div>
    </div>
  );
}
