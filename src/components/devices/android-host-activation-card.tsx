"use client";

import { Smartphone } from "lucide-react";
import { useEffect, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "mtxuilib/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "mtxuilib/ui/card";
import { activateAndroidHostDeviceAction, bindAndroidHostDeviceAction, stopAndroidHostDeviceAction } from "@/app/(dash)/dash/devices/actions";
import { buildDeviceStateItems, canStartAndroidHostDeviceService, canStopAndroidHostDeviceService } from "@/components/devices/device-state";
import {
  type AndroidActivationSurface,
  readAndroidActivationSurface,
  readAndroidHostInfo,
  requestAndroidDeviceServiceStart,
  requestAndroidDeviceServiceStop,
} from "@/lib/android-host/bridge";

function wait(ms: number) {
  return new Promise((resolve) => {
    window.setTimeout(resolve, ms);
  });
}

async function waitForAndroidActivationSurface(
  predicate: (surface: AndroidActivationSurface | null) => boolean,
  syncSurface: (surface: AndroidActivationSurface | null) => void,
  timeoutMs = 5000,
) {
  const startedAt = Date.now();
  while (Date.now() - startedAt <= timeoutMs) {
    const surface = readAndroidActivationSurface();
    syncSurface(surface);
    if (predicate(surface)) {
      return true;
    }
    await wait(250);
  }
  return false;
}

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

export interface AndroidHostCurrentDevice {
  id: string;
  activationStatus: string;
  presenceStatus: string;
  runtimeStatus: string;
  lastSeenAt: string | null;
  lastError: string | null;
}

interface AndroidHostActivationCardProps {
  currentDevice?: AndroidHostCurrentDevice | null;
}

export function AndroidHostActivationCard({ currentDevice = null }: AndroidHostActivationCardProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [boundDeviceId, setBoundDeviceId] = useState<string | null>(currentDevice?.id ?? null);
  const hostInfo = useMemo(() => readAndroidHostInfo(), []);
  const [activationSurface, setActivationSurface] = useState(() => readAndroidActivationSurface());

  useEffect(() => {
    setBoundDeviceId(currentDevice?.id ?? null);
  }, [currentDevice?.id]);

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
        const deviceId = typeof result?.device?.id === "string" ? result.device.id : null;
        const credentialVersion = typeof result?.runtimeCredential?.version === "number" ? result.runtimeCredential.version : null;
        setBoundDeviceId(deviceId);
        toast.success("当前 Android 宿主已绑定", {
          description: credentialVersion === null ? "设备已进入 bound_inactive；下一步可显式启动设备服务。" : `设备已进入 bound_inactive，并签发运行凭据 v${credentialVersion}。`,
        });
        router.refresh();
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "绑定当前设备失败");
      }
    });
  };

  const handleStartDeviceService = () => {
    if (!boundDeviceId) {
      toast.error("请先绑定当前设备");
      return;
    }

    const accepted = requestAndroidDeviceServiceStart();
    if (!accepted) {
      toast.error("当前宿主不支持启动设备服务");
      return;
    }

    const bindingPayload = buildBindingPayload(hostInfo);
    startTransition(async () => {
      try {
        const hostConfirmed = await waitForAndroidActivationSurface(
          (surface) => surface?.serviceActivationRequested === true,
          setActivationSurface,
        );
        if (!hostConfirmed) {
          throw new Error("宿主尚未确认设备服务已启动，未推进数据库状态");
        }
        await activateAndroidHostDeviceAction({
          deviceId: boundDeviceId,
          capabilities: {
            device_service: "requested",
            screen_capture: activationSurface?.canRequestScreenCapture ? "prompt_available" : "unknown",
          },
          metadata: {
            ...bindingPayload.metadata,
            activation_source: "gomtmui_webview_bridge",
            host_action_state: activationSurface?.hostActionState ?? "device_service_activation_requested",
          },
        });
        setActivationSurface(readAndroidActivationSurface());
        toast.success("已请求启动设备服务", {
          description: "数据库中的设备运行态已推进到第一阶段最小闭环，可在设备列表查看三层状态。",
        });
        router.refresh();
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "启动设备服务后推进数据库状态失败");
      }
    });
  };

  const handleStopDeviceService = () => {
    if (!boundDeviceId) {
      toast.error("请先绑定当前设备");
      return;
    }

    const accepted = requestAndroidDeviceServiceStop();
    if (!accepted) {
      toast.error("当前宿主不支持停止设备服务");
      return;
    }

    startTransition(async () => {
      try {
        const hostConfirmed = await waitForAndroidActivationSurface(
          (surface) => surface?.serviceActivationRequested === false,
          setActivationSurface,
        );
        if (!hostConfirmed) {
          throw new Error("宿主尚未确认设备服务已停止，未回退数据库状态");
        }
        await stopAndroidHostDeviceAction({
          deviceId: boundDeviceId,
          lastError: null,
        });
        setActivationSurface(readAndroidActivationSurface());
        toast.success("已请求停止设备服务", {
          description: "数据库中的当前设备状态已回退到 inactive/stopped。",
        });
        router.refresh();
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "停止设备服务后回退数据库状态失败");
      }
    });
  };

  const canStartDeviceService = canStartAndroidHostDeviceService({
    boundDeviceId,
    activationSurfaceCanStart: Boolean(activationSurface?.canStartDeviceService),
  });
  const canStopDeviceService = canStopAndroidHostDeviceService({
    boundDeviceId,
    activationSurfaceCanStop: Boolean(activationSurface?.canStopDeviceService),
  });
  const currentDeviceStateItems = currentDevice
    ? buildDeviceStateItems({
        activationStatus: currentDevice.activationStatus,
        presenceStatus: currentDevice.presenceStatus,
        runtimeStatus: currentDevice.runtimeStatus,
      })
    : [];

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

        {currentDevice ? (
          <div className="rounded-md border bg-muted/30 p-3">
            <div className="text-muted-foreground">数据库中的当前设备状态</div>
            <div className="mt-2 flex flex-wrap gap-2">
              {currentDeviceStateItems.map((item) => (
                <span key={item.label} className="rounded-full border px-2 py-1 text-xs">
                  {item.label}:{item.value}
                </span>
              ))}
            </div>
            <div className="mt-2 text-xs text-muted-foreground">最近在线：{currentDevice.lastSeenAt ?? "-"}</div>
            <div className="mt-1 text-xs text-muted-foreground">最近错误：{currentDevice.lastError ?? "-"}</div>
          </div>
        ) : null}

        <div className="flex flex-wrap gap-2">
          <Button type="button" disabled={isPending} onClick={handleBindCurrentDevice}>
            {isPending ? "绑定中..." : "绑定当前设备"}
          </Button>
          <Button type="button" disabled={!canStartDeviceService || isPending} onClick={handleStartDeviceService} variant="outline">
            启动设备服务
          </Button>
          <Button type="button" disabled={!canStopDeviceService || isPending} onClick={handleStopDeviceService} variant="outline">
            停止设备服务
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
