"use client";

import { Loader2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "mtxuilib/ui/card";
import { useJobQueueStats } from "./hooks/useJobQueue";

export function JobQueueStats() {
  const { data: stats, isLoading, error } = useJobQueueStats();

  if (isLoading) {
    return (
      <div className="flex justify-center p-4">
        <Loader2 className="animate-spin" />
      </div>
    );
  }

  if (error) {
    return <div className="text-red-500">Failed to load stats: {error.message}</div>;
  }

  return (
    <div className="grid gap-4 md:grid-cols-3">
      {stats?.map((stat) => (
        <Card key={stat.queue_name}>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">{stat.queue_name}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stat.dlq_count}</div>
            <p className="text-xs text-muted-foreground">DLQ Messages</p>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
