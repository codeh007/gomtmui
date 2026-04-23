"use client";

import { Clock3, TimerReset } from "lucide-react";
import { Badge } from "mtxuilib/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "mtxuilib/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "mtxuilib/ui/table";
import { useEffect, useMemo, useState } from "react";

import { hermesApi } from "@/lib/hermes/api";
import type { CronJob } from "@/lib/hermes/types";

function formatDateTime(value?: string | null): string {
  if (!value) return "-";

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return date.toLocaleString();
}

function formatPromptSummary(prompt: string): string {
  const collapsed = prompt.replace(/\s+/g, " ").trim();
  if (collapsed.length <= 120) {
    return collapsed;
  }
  return `${collapsed.slice(0, 117)}...`;
}

function getStateVariant(job: CronJob): "default" | "secondary" | "destructive" | "outline" {
  if (job.state === "error") return "destructive";
  if (job.enabled && (job.state === "scheduled" || job.state === "enabled")) return "default";
  if (!job.enabled || job.state === "paused") return "secondary";
  return "outline";
}

export function HermesCronPage() {
  const [jobs, setJobs] = useState<CronJob[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    hermesApi
      .getCronJobs()
      .then((response) => {
        if (cancelled) return;
        setJobs(response);
        setError(null);
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : String(err));
      })
      .finally(() => {
        if (cancelled) return;
        setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  const activeCount = useMemo(() => jobs.filter((job) => job.enabled).length, [jobs]);

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Clock3 className="h-4 w-4 text-muted-foreground" />
            Scheduled Jobs
            <Badge variant="secondary">{jobs.length}</Badge>
          </CardTitle>
          <CardDescription>
            首版仅提供浏览能力，任务创建与调度控制后续开放。
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-3 text-xs text-muted-foreground">
          <span>{activeCount} enabled</span>
          <span>{Math.max(jobs.length - activeCount, 0)} inactive</span>
        </CardContent>
      </Card>

      {error ? <div className="rounded-lg border border-destructive/30 px-4 py-3 text-sm text-destructive">{error}</div> : null}
      {loading ? <div className="rounded-lg border px-4 py-8 text-sm text-muted-foreground">Loading cron jobs...</div> : null}

      {!loading && !error ? (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <TimerReset className="h-4 w-4 text-muted-foreground" />
              Job Status
            </CardTitle>
          </CardHeader>
          <CardContent>
            {jobs.length === 0 ? (
              <div className="text-sm text-muted-foreground">No Hermes cron jobs are configured.</div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Job</TableHead>
                    <TableHead>Prompt</TableHead>
                    <TableHead>Schedule</TableHead>
                    <TableHead>Deliver</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Last Run</TableHead>
                    <TableHead>Next Run</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {jobs.map((job) => (
                    <TableRow key={job.id}>
                      <TableCell>
                        <div className="flex min-w-0 flex-col gap-1">
                          <span className="font-medium">{job.name || "Untitled job"}</span>
                          <span className="font-mono text-[11px] text-muted-foreground">{job.id}</span>
                        </div>
                      </TableCell>
                      <TableCell className="max-w-[360px]">
                        <div className="space-y-1">
                          <div className="line-clamp-2 text-sm text-muted-foreground">{formatPromptSummary(job.prompt)}</div>
                          {job.last_error ? <div className="text-xs text-destructive">{job.last_error}</div> : null}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex min-w-0 flex-col gap-1">
                          <span className="font-mono text-xs">{job.schedule_display || job.schedule?.display || job.schedule?.expr || "-"}</span>
                          <span className="text-[11px] text-muted-foreground">{job.schedule?.kind || "custom"}</span>
                        </div>
                      </TableCell>
                      <TableCell>{job.deliver || "local"}</TableCell>
                      <TableCell>
                        <div className="flex flex-col gap-1">
                          <Badge variant={getStateVariant(job)}>{job.state}</Badge>
                          <span className="text-[11px] text-muted-foreground">{job.enabled ? "enabled" : "disabled"}</span>
                        </div>
                      </TableCell>
                      <TableCell className="text-muted-foreground">{formatDateTime(job.last_run_at)}</TableCell>
                      <TableCell className="text-muted-foreground">{formatDateTime(job.next_run_at)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}
