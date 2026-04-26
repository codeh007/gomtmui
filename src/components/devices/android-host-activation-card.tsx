"use client";

import { Smartphone } from "lucide-react";
import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "mtxuilib/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "mtxuilib/ui/card";
import { bindAndroidHostDeviceAction } from "@/app/(dash)/dash/devices/actions";
import { readAndroidActivationSurface, readAndroidHostInfo } from "@/lib/android-host/bridge";

function buildBindingPayload(hostInfo: NonNullable<ReturnType<typeof readAndroidHostInfo>>) {
  const packageName = hostInfo.packageName?.trim();
  const appVersion = hostInfo.appVersion?.trim();
  return {
    name: appVersion ? `Android ${appVersion}` : "Android Host",
    platform: "android",
    metadata: {
      hostKind: hostInfo.hostKind,
      packageName: packageName ?? null,
      appVersion: appVersion ?? null,
      dashP2pUrl: hostInfo.dashP2pUrl ?? null,
    },
    tags: ["android-host"],
  };
}

export function AndroidHostActivationCard() {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [boundDeviceId, setBoundDeviceId] = useState<string | null>(null);
  const hostInfo = useMemo(() => readAndroidHostInfo(), []);
  const activationSurface = useMemo(() => readAndroidActivationSurface(), []);

  if (!hostInfo) {
    return null;
  }

  const handleBindCurrentDevice = () => {
    const payload = buildBindingPayload(hostInfo);
    startTransition(async () => {
      try {
        const result = await bindAndroidHostDeviceAction(payload);
        const device = Array.isArray(result) ? result[0] : result;
        setBoundDeviceId(typeof device?.id === "string" ? device.id : null);
        toast.success("当前 Android 宿主已绑定", {
          description: "设备已进入 bound_inactive；下一步再接前台服务启动与 runtime credential。",
        });
        router.refresh();
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "绑定当前设备失败");
      }
    });
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Smartphone className="h-4 w-4" />
          检测到 Android 宿主环境
        </CardTitle>
        <CardDescription>当前页面运行在 gomtm-android WebView 中。此阶段先完成“登录用户绑定当前宿主设备”的最小闭环。</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4 text-sm">
        <div className="grid gap-2 sm:grid-cols-2">
          <div>
            <div className="text-muted-foreground">宿主类型</div>
            <div className="font-medium">{hostInfo.hostKind}</div>
          </div>
          <div>
            <div className="text-muted-foreground">应用版本</div>
            <div className="font-medium">{hostInfo.appVersion ?? "-"}</div>
          </div>
          <div className="sm:col-span-2">
            <div className="text-muted-foreground">包名</div>
            <div className="font-mono text-xs">{hostInfo.packageName ?? "-"}</div>
          </div>
          {boundDeviceId ? (
            <div className="sm:col-span-2">
              <div className="text-muted-foreground">最近绑定设备</div>
              <div className="font-mono text-xs">{boundDeviceId}</div>
            </div>
          ) : null}
        </div>

        <div className="rounded-md border bg-muted/30 p-3">
          <div className="text-muted-foreground">当前激活面状态</div>
          <div className="mt-1 font-medium">
            activation={activationSurface?.activationStatus ?? "unknown"} · runtime={activationSurface?.runtimeStatus ?? "unknown"}
          </div>
          <div className="mt-1 text-xs text-muted-foreground">绑定成功后设备应进入 bound_inactive。此时仍未启动前台服务，也不应声明在线。</div>
        </div>

        <div className="flex flex-wrap gap-2">
          <Button type="button" disabled={isPending} onClick={handleBindCurrentDevice}>
            {isPending ? "绑定中..." : "绑定当前设备"}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
