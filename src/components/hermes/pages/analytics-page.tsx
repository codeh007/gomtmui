"use client";

import { BarChart3, Brain, Hash, TrendingUp } from "lucide-react";
import { Button } from "mtxuilib/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "mtxuilib/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "mtxuilib/ui/table";
import type { ComponentType } from "react";
import { useEffect, useMemo, useState } from "react";

import { useHermesApi } from "@/components/hermes/use-hermes-api";
import { formatTokenCount } from "@/lib/hermes/format";
import type { AnalyticsDailyEntry, AnalyticsModelEntry, AnalyticsResponse, AnalyticsSkillEntry } from "@/lib/hermes/types";
import { timeAgo } from "@/lib/hermes/utils";

const PERIODS = [
  { days: 7, label: "7d" },
  { days: 30, label: "30d" },
  { days: 90, label: "90d" },
] as const;

const CHART_HEIGHT = 160;

function formatDay(day: string): string {
  try {
    return new Date(`${day}T00:00:00`).toLocaleDateString(undefined, {
      day: "numeric",
      month: "short",
    });
  } catch {
    return day;
  }
}

function SummaryCard({
  icon: Icon,
  label,
  sublabel,
  value,
}: {
  icon: ComponentType<{ className?: string }>;
  label: string;
  sublabel?: string;
  value: string;
}) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium">{label}</CardTitle>
        <Icon className="h-4 w-4 text-muted-foreground" />
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-semibold">{value}</div>
        {sublabel ? <div className="text-xs text-muted-foreground">{sublabel}</div> : null}
      </CardContent>
    </Card>
  );
}

function TokenChart({ daily }: { daily: AnalyticsDailyEntry[] }) {
  const maxTotal = Math.max(...daily.map((entry) => entry.input_tokens + entry.output_tokens), 1);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <BarChart3 className="h-4 w-4 text-muted-foreground" />
          Daily Token Usage
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex items-end gap-1" style={{ height: CHART_HEIGHT }}>
          {daily.map((entry) => {
            const inputHeight = Math.max(Math.round((entry.input_tokens / maxTotal) * CHART_HEIGHT), entry.input_tokens > 0 ? 2 : 0);
            const outputHeight = Math.max(Math.round((entry.output_tokens / maxTotal) * CHART_HEIGHT), entry.output_tokens > 0 ? 2 : 0);
            const total = entry.input_tokens + entry.output_tokens;

            return (
              <div key={entry.day} className="group relative flex min-w-0 flex-1 flex-col justify-end">
                <div className="pointer-events-none absolute bottom-full left-1/2 z-10 mb-2 hidden -translate-x-1/2 rounded-md border bg-background px-2 py-1 text-[10px] shadow-md group-hover:block">
                  <div className="font-medium">{formatDay(entry.day)}</div>
                  <div>Input: {formatTokenCount(entry.input_tokens)}</div>
                  <div>Output: {formatTokenCount(entry.output_tokens)}</div>
                  <div>Total: {formatTokenCount(total)}</div>
                </div>
                <div className="w-full bg-primary/30" style={{ height: inputHeight }} />
                <div className="w-full bg-emerald-500/70" style={{ height: outputHeight }} />
              </div>
            );
          })}
        </div>
        <div className="mt-2 flex justify-between text-[10px] text-muted-foreground">
          <span>{daily[0] ? formatDay(daily[0].day) : ""}</span>
          <span>{daily[Math.floor(daily.length / 2)] ? formatDay(daily[Math.floor(daily.length / 2)].day) : ""}</span>
          <span>{daily[daily.length - 1] ? formatDay(daily[daily.length - 1].day) : ""}</span>
        </div>
      </CardContent>
    </Card>
  );
}

function DailyTable({ daily }: { daily: AnalyticsDailyEntry[] }) {
  const rows = [...daily].reverse();
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Daily Breakdown</CardTitle>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Day</TableHead>
              <TableHead>Sessions</TableHead>
              <TableHead>API Calls</TableHead>
              <TableHead>Input</TableHead>
              <TableHead>Output</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((entry) => (
              <TableRow key={entry.day}>
                <TableCell className="font-medium">{formatDay(entry.day)}</TableCell>
                <TableCell>{entry.sessions}</TableCell>
                <TableCell>{entry.api_calls}</TableCell>
                <TableCell>{formatTokenCount(entry.input_tokens)}</TableCell>
                <TableCell>{formatTokenCount(entry.output_tokens)}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}

function ModelTable({ models }: { models: AnalyticsModelEntry[] }) {
  const rows = [...models].sort((left, right) => right.input_tokens + right.output_tokens - (left.input_tokens + left.output_tokens));
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">By Model</CardTitle>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Model</TableHead>
              <TableHead>Sessions</TableHead>
              <TableHead>API Calls</TableHead>
              <TableHead>Input</TableHead>
              <TableHead>Output</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((model) => (
              <TableRow key={model.model}>
                <TableCell className="font-mono text-xs">{model.model}</TableCell>
                <TableCell>{model.sessions}</TableCell>
                <TableCell>{model.api_calls}</TableCell>
                <TableCell>{formatTokenCount(model.input_tokens)}</TableCell>
                <TableCell>{formatTokenCount(model.output_tokens)}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}

function SkillTable({ skills }: { skills: AnalyticsSkillEntry[] }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Skills</CardTitle>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Skill</TableHead>
              <TableHead>Loads</TableHead>
              <TableHead>Edits</TableHead>
              <TableHead>Total</TableHead>
              <TableHead>Last Used</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {skills.map((skill) => (
              <TableRow key={skill.skill}>
                <TableCell className="font-mono text-xs">{skill.skill}</TableCell>
                <TableCell>{skill.view_count}</TableCell>
                <TableCell>{skill.manage_count}</TableCell>
                <TableCell>{skill.total_count}</TableCell>
                <TableCell>{skill.last_used_at ? timeAgo(skill.last_used_at) : "-"}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}

export function HermesAnalyticsPage() {
  const hermesApi = useHermesApi();
  const [days, setDays] = useState<number>(30);
  const [data, setData] = useState<AnalyticsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);

    hermesApi
      .getAnalytics(days)
      .then((response) => {
        if (cancelled) return;
        setData(response);
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
  }, [days, hermesApi]);

  const totalTokens = useMemo(() => {
    if (!data) return 0;
    return data.totals.total_input + data.totals.total_output;
  }, [data]);

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <span className="text-sm text-muted-foreground">Period</span>
        {PERIODS.map((period) => (
          <Button key={period.days} size="sm" variant={days === period.days ? "default" : "outline"} onClick={() => setDays(period.days)}>
            {period.label}
          </Button>
        ))}
      </div>

      {error ? <div className="rounded-lg border border-destructive/30 px-4 py-3 text-sm text-destructive">{error}</div> : null}
      {loading && !data ? <div className="rounded-lg border px-4 py-8 text-sm text-muted-foreground">Loading analytics...</div> : null}

      {data ? (
        <>
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <SummaryCard
              icon={Hash}
              label="Total Tokens"
              sublabel={`Input ${formatTokenCount(data.totals.total_input)} / Output ${formatTokenCount(data.totals.total_output)}`}
              value={formatTokenCount(totalTokens)}
            />
            <SummaryCard icon={BarChart3} label="Sessions" sublabel={`${days} day window`} value={String(data.totals.total_sessions)} />
            <SummaryCard icon={TrendingUp} label="API Calls" sublabel={`${data.by_model.length} active models`} value={String(data.totals.total_api_calls)} />
            <SummaryCard
              icon={Brain}
              label="Distinct Skills"
              sublabel={`${data.skills.summary.total_skill_actions} total skill actions`}
              value={String(data.skills.summary.distinct_skills_used)}
            />
          </div>

          {data.daily.length > 0 ? <TokenChart daily={data.daily} /> : null}

          <div className="grid gap-4 xl:grid-cols-2">
            <DailyTable daily={data.daily} />
            <ModelTable models={data.by_model} />
          </div>

          <SkillTable skills={data.skills.top_skills} />

          {data.daily.length === 0 && data.by_model.length === 0 && data.skills.top_skills.length === 0 ? (
            <Card>
              <CardContent className="py-8 text-sm text-muted-foreground">No Hermes analytics data is available for the selected period.</CardContent>
            </Card>
          ) : null}
        </>
      ) : null}
    </div>
  );
}
