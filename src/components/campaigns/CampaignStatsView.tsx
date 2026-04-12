"use client";

import { Card, CardContent, CardHeader, CardTitle } from "mtxuilib/ui/card";
import { useMemo } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { useCampaignGet } from "./hooks/use-campaigns";

export function CampaignStatsView({ campaignId }: { campaignId: string }) {
  const { data: campaign, isLoading } = useCampaignGet(campaignId);

  const stats = useMemo(() => {
    const raw = campaign?.stats;
    const total = raw?.total_tasks ?? 0;
    const sent = raw?.sent_count ?? 0;
    const failed = raw?.fail_count ?? 0;
    const replied = raw?.reply_count ?? 0;
    const successBase = sent > 0 ? sent : total;
    const successRate = successBase > 0 ? Math.round(((raw?.success_count ?? 0) / successBase) * 100) : 0;
    const replyRate = sent > 0 ? Math.round((replied / sent) * 100) : 0;

    return {
      total,
      sent,
      failed,
      replied,
      success_rate: successRate,
      reply_rate: replyRate,
    };
  }, [campaign]);

  const trend: { date: string; sent_count: number; reply_count: number }[] = [];

  if (isLoading) {
    return (
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {[1, 2, 3, 4].map((i) => (
          <Card key={i} className="animate-pulse h-32 bg-muted/20" />
        ))}
      </div>
    );
  }

  if (!campaign) return <div className="p-4 text-center text-muted-foreground">No stats available</div>;

  const funnelData = [
    { name: "Target", value: stats.total, fill: "#8884d8" },
    { name: "Sent", value: stats.sent, fill: "#82ca9d" },
    { name: "Replied", value: stats.replied, fill: "#ffc658" },
  ];

  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <StatsCard title="Total Target" value={stats.total} icon="🎯" />
        <StatsCard title="Sent Successfully" value={stats.sent} sub={`${stats.success_rate}% success`} icon="🚀" />
        <StatsCard title="Replies" value={stats.replied} sub={`${stats.reply_rate}% rate`} icon="💬" />
        <StatsCard title="Failed" value={stats.failed} className="text-destructive" icon="❌" />
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Sending Trend (Last 14 Days)</CardTitle>
          </CardHeader>
          <CardContent className="h-[300px]">
            {trend.length === 0 ? (
              <div className="flex h-full items-center justify-center text-sm text-muted-foreground">暂无趋势数据</div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={trend} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} />
                  <XAxis
                    dataKey="date"
                    tickFormatter={(val) => new Date(val).toLocaleDateString([], { month: "short", day: "numeric" })}
                    fontSize={12}
                    tickLine={false}
                    axisLine={false}
                  />
                  <YAxis fontSize={12} tickLine={false} axisLine={false} />
                  <Tooltip
                    labelFormatter={(val) => new Date(val).toLocaleDateString()}
                    contentStyle={{ borderRadius: "8px", border: "none", boxShadow: "0 4px 6px -1px rgb(0 0 0 / 0.1)" }}
                  />
                  <Legend />
                  <Line
                    type="monotone"
                    dataKey="sent_count"
                    name="Sent"
                    stroke="#8884d8"
                    strokeWidth={2}
                    dot={false}
                    activeDot={{ r: 6 }}
                  />
                  <Line
                    type="monotone"
                    dataKey="reply_count"
                    name="Replies"
                    stroke="#82ca9d"
                    strokeWidth={2}
                    dot={false}
                  />
                </LineChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Conversion Funnel</CardTitle>
          </CardHeader>
          <CardContent className="h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={funnelData} layout="vertical" margin={{ left: 20, right: 20 }}>
                <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                <XAxis type="number" fontSize={12} tickLine={false} axisLine={false} />
                <YAxis dataKey="name" type="category" width={60} fontSize={12} tickLine={false} axisLine={false} />
                <Tooltip cursor={{ fill: "transparent" }} contentStyle={{ borderRadius: "8px" }} />
                <Bar dataKey="value" radius={[0, 4, 4, 0]} barSize={32} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function StatsCard({ title, value, sub, className, icon }: any) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium">{title}</CardTitle>
        <span className="text-2xl">{icon}</span>
      </CardHeader>
      <CardContent>
        <div className={`text-2xl font-bold ${className}`}>{value}</div>
        {sub && <p className="text-xs text-muted-foreground">{sub}</p>}
      </CardContent>
    </Card>
  );
}
