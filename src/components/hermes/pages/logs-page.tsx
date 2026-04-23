"use client";

import { FileText, RefreshCw } from "lucide-react";
import { Badge } from "mtxuilib/ui/badge";
import { Button } from "mtxuilib/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "mtxuilib/ui/card";
import { Label } from "mtxuilib/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "mtxuilib/ui/select";
import { Switch } from "mtxuilib/ui/switch";
import { useCallback, useEffect, useRef, useState } from "react";

import { hermesApi } from "@/lib/hermes/api";

const FILES = ["agent", "errors", "gateway"] as const;
const LEVELS = ["ALL", "DEBUG", "INFO", "WARNING", "ERROR"] as const;
const COMPONENTS = ["all", "gateway", "agent", "tools", "cli", "cron"] as const;
const LINE_COUNTS = [50, 100, 200, 500] as const;

function classifyLine(line: string): "debug" | "error" | "info" | "warning" {
  const upper = line.toUpperCase();
  if (upper.includes("ERROR") || upper.includes("CRITICAL") || upper.includes("FATAL")) return "error";
  if (upper.includes("WARNING") || upper.includes("WARN")) return "warning";
  if (upper.includes("DEBUG")) return "debug";
  return "info";
}

const LINE_TONE: Record<ReturnType<typeof classifyLine>, string> = {
  debug: "text-muted-foreground/70",
  error: "text-destructive",
  info: "text-foreground",
  warning: "text-warning",
};

export function HermesLogsPage() {
  const [file, setFile] = useState<(typeof FILES)[number]>("agent");
  const [level, setLevel] = useState<(typeof LEVELS)[number]>("ALL");
  const [component, setComponent] = useState<(typeof COMPONENTS)[number]>("all");
  const [lineCount, setLineCount] = useState<(typeof LINE_COUNTS)[number]>(100);
  const [autoRefresh, setAutoRefresh] = useState(false);
  const [lines, setLines] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement | null>(null);

  const fetchLogs = useCallback(() => {
    setLoading(true);
    hermesApi
      .getLogs({ component, file, level, lines: lineCount })
      .then((response) => {
        setLines(response.lines);
        setError(null);
        requestAnimationFrame(() => {
          if (scrollRef.current) {
            scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
          }
        });
      })
      .catch((err: unknown) => setError(err instanceof Error ? err.message : String(err)))
      .finally(() => setLoading(false));
  }, [component, file, level, lineCount]);

  useEffect(() => {
    fetchLogs();
  }, [fetchLogs]);

  useEffect(() => {
    if (!autoRefresh) {
      return;
    }
    const interval = setInterval(fetchLogs, 5000);
    return () => clearInterval(interval);
  }, [autoRefresh, fetchLogs]);

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
            <CardTitle className="flex items-center gap-2 text-base">
              <FileText className="h-4 w-4 text-muted-foreground" />
              Hermes Logs
              <Badge variant="secondary">{file}</Badge>
            </CardTitle>
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-2">
                <Switch checked={autoRefresh} onCheckedChange={setAutoRefresh} />
                <Label>Auto refresh</Label>
              </div>
              <Button size="sm" variant="outline" onClick={fetchLogs}>
                <RefreshCw className={`mr-2 h-4 w-4 ${loading ? "animate-spin" : ""}`} />
                Refresh
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <div className="space-y-2">
            <Label>File</Label>
            <Select value={file} onValueChange={(value) => setFile(value as (typeof FILES)[number])}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {FILES.map((entry) => (
                  <SelectItem key={entry} value={entry}>
                    {entry}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Level</Label>
            <Select value={level} onValueChange={(value) => setLevel(value as (typeof LEVELS)[number])}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {LEVELS.map((entry) => (
                  <SelectItem key={entry} value={entry}>
                    {entry}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Component</Label>
            <Select value={component} onValueChange={(value) => setComponent(value as (typeof COMPONENTS)[number])}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {COMPONENTS.map((entry) => (
                  <SelectItem key={entry} value={entry}>
                    {entry}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Lines</Label>
            <Select value={String(lineCount)} onValueChange={(value) => setLineCount(Number(value) as (typeof LINE_COUNTS)[number])}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {LINE_COUNTS.map((entry) => (
                  <SelectItem key={entry} value={String(entry)}>
                    {entry}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">{file}.log</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {error ? <div className="border-b border-destructive/20 bg-destructive/5 px-4 py-3 text-sm text-destructive">{error}</div> : null}
          <div ref={scrollRef} className="max-h-[640px] min-h-[260px] overflow-auto px-4 py-4 font-mono text-xs leading-6">
            {!loading && lines.length === 0 ? <div className="text-sm text-muted-foreground">No log lines returned.</div> : null}
            {lines.map((line, index) => (
              <div key={`${file}-${index}`} className={`rounded px-1 hover:bg-muted/40 ${LINE_TONE[classifyLine(line)]}`}>
                {line}
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
