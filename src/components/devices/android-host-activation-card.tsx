"use client";

import { Smartphone } from "lucide-react";
import { useEffect, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "mtxuilib/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "mtxuilib/ui/card";
import { bindAndroidHostDeviceAction } from "@/app/(dash)/dash/devices/actions";
import {
  readAndroidActivationSurface,
  readAndroidHostInfo,
  requestAndroidDeviceServiceStart,
} from "@/lib/android-host/bridge";

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
  const [activationSurface, setActivationSurface] = useState(() => readAndroidActivationSurface());

  useEffect(() => {
    const timer = window.setInterval(() => {
      setActivationSurface(readAndroidActivationSurface());
    }, 1000);
    return () => window.clearInterval(timer);
  }, []);

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
          description: "设备已进入 bound_inactive；下一步可显式启动设备服务。",
        });
        router.refresh();
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "绑定当前设备失败");
      }
    });
  };

  const handleStartDeviceService = () => {
    const accepted = requestAndroidDeviceServiceStart();
    if (!accepted) {
      toast.error("当前宿主不支持启动设备服务");
      return;
    }
    setActivationSurface(readAndroidActivationSurface());
    toast.success("已请求启动设备服务", {
      description: "当前回读的是 Android 宿主壳动作面；核心业务 runtime 状态后续应改由 gomtm AAR/Go 核心提供。",
    });
  };

  const canStartDeviceService = Boolean(boundDeviceId) && Boolean(activationSurface?.canStartDeviceService);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Smartphone className="h-4 w-4" />
          检测到 Android 宿主环境
        </CardTitle>
        <CardDescription>当前页面运行在 gomtm-android WebView 中。此阶段先完成“登录用户绑定当前宿主设备”，再显式触发设备服务启动；宿主壳只暴露最小动作面，不承担核心业务状态真相。</CardDescription>
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
          <div className="text-muted-foreground">当前宿主激活面</div>
          <div className="mt-1 font-medium">
            activation={activationSurface?.activationStatus ?? "unknown"} · hostAction={activationSurface?.hostActionState ?? "unknown"}
          </div>
          <div className="mt-1 text-xs text-muted-foreground">这里显示的是 Android 壳层是否已经收到“启动设备服务”的动作回执，不代表设备核心 runtime 已 ready；真正的数据库层、核心状态与后续 heartbeat 仍应收敛到 gomtm AAR / Go 核心。</div>
        </div>

        <div className="flex flex-wrap gap-2">
          <Button type="button" disabled={isPending} onClick={handleBindCurrentDevice}>
            {isPending ? "绑定中..." : "绑定当前设备"}
          </Button>
          <Button type="button" disabled={!canStartDeviceService || isPending} onClick={handleStartDeviceService} variant="outline">
            启动设备服务
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
