"use client";

import { AlertTriangle, Cpu, Radio, TerminalSquare } from "lucide-react";
import { Badge } from "mtxuilib/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "mtxuilib/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "mtxuilib/ui/table";
import { useEffect, useState } from "react";

import { useHermesApi } from "@/components/hermes/use-hermes-api";
import { formatTokenCount } from "@/lib/hermes/format";
import type { SessionInfo, StatusResponse } from "@/lib/hermes/types";
import { isoTimeAgo, timeAgo } from "@/lib/hermes/utils";

type LoadState = {
  sessions: SessionInfo[];
  status: StatusResponse | null;
};

type AlertItem = {
  detail?: string;
  message: string;
};

function toneForPlatformState(state: string): "default" | "destructive" | "outline" | "secondary" {
  if (state === "connected") return "default";
  if (state === "fatal") return "destructive";
  if (state === "disconnected") return "secondary";
  return "outline";
}

function gatewayLabel(status: StatusResponse): string {
  if (status.gateway_running && status.gateway_health_url) {
    return status.gateway_health_url;
  }

  if (status.gateway_running && status.gateway_pid) {
    return `PID ${status.gateway_pid}`;
  }

  if (status.gateway_running) {
    return "Running";
  }

  if (status.gateway_state === "startup_failed") {
    return "Startup failed";
  }

  return "Not running";
}

function collectAlerts(status: StatusResponse): AlertItem[] {
  const alerts: AlertItem[] = [];

  if (status.gateway_state === "startup_failed") {
    alerts.push({
      message: "Gateway failed to start",
      detail: status.gateway_exit_reason ?? undefined,
    });
  }

  for (const [name, platform] of Object.entries(status.gateway_platforms ?? {})) {
    if (platform.state === "fatal" || platform.state === "disconnected") {
      alerts.push({
        message: `${name} is ${platform.state}`,
        detail: platform.error_message ?? platform.error_code ?? undefined,
      });
    }
  }

  return alerts;
}

export function HermesStatusPage() {
  const hermesApi = useHermesApi();
  const [data, setData] = useState<LoadState>({ sessions: [], status: null });
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      try {
        const [status, sessionResponse] = await Promise.all([hermesApi.getStatus(), hermesApi.getSessions(50)]);
        if (cancelled) return;
        setData({ sessions: sessionResponse.sessions, status });
        setError(null);
      } catch (err: unknown) {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : String(err));
      }
    };

    void load();
    const interval = setInterval(() => {
      void load();
    }, 15000);

    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [hermesApi]);

  if (error) {
    return <div className="rounded-lg border border-destructive/30 px-4 py-3 text-sm text-destructive">{error}</div>;
  }

  if (!data.status) {
    return <div className="rounded-lg border px-4 py-8 text-sm text-muted-foreground">Loading Hermes status...</div>;
  }

  const { status, sessions } = data;
  const alerts = collectAlerts(status);
  const activeSessions = sessions.filter((session) => session.is_active);
  const recentSessions = [...sessions]
    .sort((left, right) => right.last_active - left.last_active)
    .slice(0, 8);
  const platformEntries = Object.entries(status.gateway_platforms ?? {});

  return (
    <div className="space-y-4">
      {alerts.length > 0 ? (
        <Card className="border-destructive/30 bg-destructive/5">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base text-destructive">
              <AlertTriangle className="h-4 w-4" />
              Alerts
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            {alerts.map((alert, index) => (
              <div key={`${alert.message}-${index}`}>
                <div className="font-medium">{alert.message}</div>
                {alert.detail ? <div className="text-destructive/70">{alert.detail}</div> : null}
              </div>
            ))}
          </CardContent>
        </Card>
      ) : null}

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Version</CardTitle>
            <Cpu className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-semibold">v{status.version}</div>
            <div className="text-xs text-muted-foreground">Released {status.release_date}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Gateway</CardTitle>
            <Radio className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-semibold">{status.gateway_running ? "Online" : "Offline"}</div>
            <div className="break-all text-xs text-muted-foreground">{gatewayLabel(status)}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Sessions</CardTitle>
            <TerminalSquare className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-semibold">{status.active_sessions}</div>
            <div className="text-xs text-muted-foreground">{activeSessions.length} active in recent list</div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Gateway Platforms</CardTitle>
        </CardHeader>
        <CardContent>
          {platformEntries.length === 0 ? (
            <div className="text-sm text-muted-foreground">No gateway platform status reported.</div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Platform</TableHead>
                  <TableHead>State</TableHead>
                  <TableHead>Updated</TableHead>
                  <TableHead>Error</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {platformEntries.map(([name, platform]) => (
                  <TableRow key={name}>
                    <TableCell className="font-medium capitalize">{name}</TableCell>
                    <TableCell>
                      <Badge variant={toneForPlatformState(platform.state)}>{platform.state}</Badge>
                    </TableCell>
                    <TableCell className="text-muted-foreground">{isoTimeAgo(platform.updated_at)}</TableCell>
                    <TableCell className="max-w-[320px] truncate text-muted-foreground">
                      {platform.error_message ?? platform.error_code ?? "-"}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Recent Sessions</CardTitle>
        </CardHeader>
        <CardContent>
          {recentSessions.length === 0 ? (
            <div className="text-sm text-muted-foreground">No sessions found.</div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Session</TableHead>
                  <TableHead>Source</TableHead>
                  <TableHead>Model</TableHead>
                  <TableHead>Messages</TableHead>
                  <TableHead>Tokens</TableHead>
                  <TableHead>Last Active</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {recentSessions.map((session) => (
                  <TableRow key={session.id}>
                    <TableCell>
                      <div className="flex flex-col gap-1">
                        <div className="flex items-center gap-2">
                          <span className="font-medium">{session.title || session.preview || "Untitled session"}</span>
                          {session.is_active ? <Badge>live</Badge> : null}
                        </div>
                        <span className="line-clamp-2 max-w-[360px] text-xs text-muted-foreground">{session.preview || session.id}</span>
                      </div>
                    </TableCell>
                    <TableCell>{session.source || "local"}</TableCell>
                    <TableCell className="max-w-[220px] truncate text-muted-foreground">{session.model || "unknown"}</TableCell>
                    <TableCell>{session.message_count}</TableCell>
                    <TableCell>
                      {formatTokenCount((session.input_tokens || 0) + (session.output_tokens || 0))}
                    </TableCell>
                    <TableCell className="text-muted-foreground">{timeAgo(session.last_active)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
