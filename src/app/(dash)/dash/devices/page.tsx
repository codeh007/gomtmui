import { Badge } from "mtxuilib/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "mtxuilib/ui/card";
import { ScrollArea } from "mtxuilib/ui/scroll-area";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "mtxuilib/ui/table";
import { DashContent, DashHeaders } from "@/components/dash-layout";
import { createClient } from "@/lib/supabase/server";
import { AndroidHostActivationCard } from "@/components/devices/android-host-activation-card";

interface DeviceRow {
  id: string;
  created_at: string;
  updated_at: string;
  name: string;
  platform: string;
  status: string;
  owner_user_id: string;
  last_seen_at: string | null;
  tags: string[];
}

function formatTime(value: string | null) {
  if (!value) {
    return "-";
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat("zh-CN", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

function statusVariant(status: string): "default" | "secondary" | "destructive" | "outline" {
  switch (status) {
    case "online":
    case "idle":
      return "default";
    case "busy":
      return "secondary";
    case "error":
    case "offline":
      return "destructive";
    default:
      return "outline";
  }
}

export default async function DevicesPage() {
  const supabase = await createClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError) {
    throw authError;
  }

  if (!user) {
    throw new Error("未登录，无法读取设备列表");
  }

  const { data: devices, error } = await supabase
    .from("devices")
    .select("id, created_at, updated_at, name, platform, status, owner_user_id, last_seen_at, tags")
    .order("updated_at", { ascending: false });

  if (error) {
    throw error;
  }

  const rows = (devices ?? []) as DeviceRow[];

  return (
    <>
      <DashHeaders>
        <div className="flex flex-col gap-1">
          <h1 className="text-lg font-semibold">设备</h1>
          <p className="text-sm text-muted-foreground">当前仅展示属于你的受管设备。数据库通过 RLS 保证用户只能看到自己的设备。</p>
        </div>
      </DashHeaders>
      <DashContent className="flex-1 overflow-auto">
        <div className="space-y-6">
          <AndroidHostActivationCard />
          <Card>
            <CardHeader>
              <CardTitle>我的设备</CardTitle>
            </CardHeader>
            <CardContent>
              {rows.length === 0 ? (
                <div className="rounded-md border border-dashed p-8 text-sm text-muted-foreground">暂无设备。第一阶段仅提供列表视图，后续再补设备注册、详情和任务关联。</div>
              ) : (
                <ScrollArea className="w-full rounded-md border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>名称</TableHead>
                        <TableHead>平台</TableHead>
                        <TableHead>状态</TableHead>
                        <TableHead>标签</TableHead>
                        <TableHead>最近在线</TableHead>
                        <TableHead>更新时间</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {rows.map((device) => (
                        <TableRow key={device.id}>
                          <TableCell>
                            <div className="flex flex-col gap-1">
                              <span className="font-medium">{device.name}</span>
                              <span className="font-mono text-xs text-muted-foreground">{device.id}</span>
                            </div>
                          </TableCell>
                          <TableCell className="uppercase">{device.platform}</TableCell>
                          <TableCell>
                            <Badge variant={statusVariant(device.status)}>{device.status}</Badge>
                          </TableCell>
                          <TableCell>
                            <div className="flex flex-wrap gap-1">
                              {device.tags.length > 0 ? (
                                device.tags.map((tag) => (
                                  <Badge key={tag} variant="outline">
                                    {tag}
                                  </Badge>
                                ))
                              ) : (
                                <span className="text-xs text-muted-foreground">-</span>
                              )}
                            </div>
                          </TableCell>
                          <TableCell>{formatTime(device.last_seen_at)}</TableCell>
                          <TableCell>{formatTime(device.updated_at)}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </ScrollArea>
              )}
            </CardContent>
          </Card>
        </div>
      </DashContent>
    </>
  );
}
