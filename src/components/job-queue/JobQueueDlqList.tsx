"use client";

import { format } from "date-fns";
import { Loader2, RefreshCcw, Trash2 } from "lucide-react";
import { Button } from "mtxuilib/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "mtxuilib/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "mtxuilib/ui/table";
import { useState } from "react";
import { useJobQueueDlqList, useJobQueuePurgeDlq, useJobQueueRetryDlq } from "./hooks/useJobQueue";

export function JobQueueDlqList({ queueName }: { queueName: string }) {
  const [page, _setPage] = useState(0);
  const pageSize = 10;

  const {
    data: dlqItems,
    isLoading,
    error,
    refetch,
  } = useJobQueueDlqList(queueName, {
    limit: pageSize,
    offset: page * pageSize,
  });

  const retryMutation = useJobQueueRetryDlq();
  const purgeMutation = useJobQueuePurgeDlq();

  const handleRetry = (msgId: number) => {
    retryMutation.mutate({ queue: queueName, msgIds: [msgId] });
  };

  const handlePurge = (msgId: number) => {
    if (confirm("Are you sure you want to permanently delete this task?")) {
      purgeMutation.mutate({ queue: queueName, msgIds: [msgId] });
    }
  };

  if (isLoading) {
    return (
      <div className="flex justify-center p-4">
        <Loader2 className="animate-spin" />
      </div>
    );
  }

  if (error) {
    return <div className="text-red-500">Failed to load DLQ: {error.message}</div>;
  }

  if (!dlqItems || dlqItems.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-medium">Dead Letter Queue ({queueName})</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-muted-foreground text-sm">No failed tasks found.</div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex justify-between items-center">
          <CardTitle className="text-sm font-medium">Dead Letter Queue ({queueName})</CardTitle>
          <Button variant="outline" size="sm" onClick={() => refetch()}>
            <RefreshCcw className="w-4 h-4 mr-2" />
            Refresh
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>ID</TableHead>
              <TableHead>Type</TableHead>
              <TableHead>Enqueued At</TableHead>
              <TableHead>Retry Count</TableHead>
              <TableHead>Error/Payload</TableHead>
              <TableHead>Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {dlqItems.map((item) => (
              <TableRow key={item.msg_id}>
                <TableCell className="font-mono text-xs">{item.msg_id}</TableCell>
                <TableCell>{item.message?.type || "Unknown"}</TableCell>
                <TableCell className="text-xs text-muted-foreground">
                  {item.enqueued_at ? format(new Date(item.enqueued_at), "yyyy-MM-dd HH:mm:ss") : "-"}
                </TableCell>
                <TableCell>{item.read_ct}</TableCell>
                <TableCell className="max-w-[200px] truncate text-xs font-mono">
                  {JSON.stringify(item.message)}
                </TableCell>
                <TableCell>
                  <div className="flex space-x-2">
                    <Button
                      variant="outline"
                      size="icon"
                      onClick={() => handleRetry(Number(item.msg_id))}
                      disabled={retryMutation.isPending}
                      title="Retry Task"
                    >
                      <RefreshCcw className="w-3 h-3" />
                    </Button>
                    <Button
                      variant="destructive"
                      size="icon"
                      onClick={() => handlePurge(Number(item.msg_id))}
                      disabled={purgeMutation.isPending}
                      title="Purge Task"
                    >
                      <Trash2 className="w-3 h-3" />
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>

        {/* Pagination Controls could be added here */}
      </CardContent>
    </Card>
  );
}
