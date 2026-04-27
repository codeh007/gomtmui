import { Badge } from "mtxuilib/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "mtxuilib/ui/card";
import { ScrollArea } from "mtxuilib/ui/scroll-area";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "mtxuilib/ui/table";
import { DashContent, DashHeaders } from "@/components/dash-layout";
import { createClient } from "@/lib/supabase/server";
import { AndroidHostActivationCard } from "@/components/devices/android-host-activation-card";
import type { AndroidHostRuntimeDevice } from "@/components/devices/device-state";

interface DeviceRow {
  id: string;
  created_at: string;
  updated_at: string;
  name: string;
  platform: string;
  owner_user_id: string;
  last_seen_at: string | null;
  tags: string[];
  activation_status: string;
  presence_status: string;
  runtime_status: string;
  last_error: string | null;
  metadata: Record<string, unknown> | null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
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

function presenceVariant(s: string): "default" | "secondary" | "destructive" | "outline" {
  switch (s) {
    case "online":
      return "default";
    case "stale":
      return "secondary";
    case "offline":
      return "destructive";
    default:
      return "outline";
  }
}

function activationLabel(s: string) {
  switch (s) {
    case "inactive":
      return "未激活";
    case "activating":
      return "激活中";
    case "active":
      return "已激活";
    case "disabled":
      return "已禁用";
    default:
      return s;
  }
}

function runtimeLabel(s: string) {
  switch (s) {
    case "stopped":
      return "已停止";
    case "booting":
      return "启动中";
    case "ready":
      return "就绪";
    case "busy":
      return "忙碌";
    case "degraded":
      return "退化";
    case "error":
      return "错误";
    default:
      return s;
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

  const { data: devices, error } = await supabase.rpc("device_list_cursor", {
    p_limit: 100,
  });

  if (error) {
    throw error;
  }

  const rows = (devices ?? []) as DeviceRow[];
  const androidHostDevices: AndroidHostRuntimeDevice[] = rows.flatMap((device) => {
    if (device.platform !== "android" || !isRecord(device.metadata) || device.metadata.hostKind !== "android-host") {
      return [];
    }
    return [
      {
        id: device.id,
        activationStatus: device.activation_status,
        presenceStatus: device.presence_status,
        runtimeStatus: device.runtime_status,
        lastSeenAt: device.last_seen_at,
        lastError: device.last_error,
        hostKind: typeof device.metadata.hostKind === "string" ? device.metadata.hostKind : null,
        packageName: typeof device.metadata.packageName === "string" ? device.metadata.packageName : null,
      },
    ];
  });

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
          <AndroidHostActivationCard devices={androidHostDevices} />
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
                        <TableHead>激活</TableHead>
                        <TableHead>在线</TableHead>
                        <TableHead>运行时</TableHead>
                        <TableHead>标签</TableHead>
                        <TableHead>最近心跳</TableHead>
                        <TableHead>错误</TableHead>
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
                            <Badge variant="outline">{activationLabel(device.activation_status)}</Badge>
                          </TableCell>
                          <TableCell>
                            <Badge variant={presenceVariant(device.presence_status)}>{device.presence_status}</Badge>
                          </TableCell>
                          <TableCell>
                            <Badge variant={device.runtime_status === "error" ? "destructive" : "secondary"}>
                              {runtimeLabel(device.runtime_status)}
                            </Badge>
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
                          <TableCell className="max-w-[200px] truncate text-xs text-muted-foreground">
                            {device.last_error ?? "-"}
                          </TableCell>
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
