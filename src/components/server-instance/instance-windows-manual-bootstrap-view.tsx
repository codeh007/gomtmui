"use client";

import { Loader2, MonitorCog } from "lucide-react";
import { Alert, AlertDescription } from "mtxuilib/ui/alert";
import { Button } from "mtxuilib/ui/button";
import { Field, FieldDescription, FieldLabel } from "mtxuilib/ui/field";
import { Textarea } from "mtxuilib/ui/textarea";
import { useState } from "react";

type WindowsManualBootstrapResponse = {
  id: string;
  hostname: string;
  command: string;
  install_url?: string;
  public_url?: string;
  expires_at?: string;
};

interface InstanceWindowsManualBootstrapViewProps {
  onCreated?: (result: { id: string }) => void;
  onCancel?: () => void;
  serverId?: string;
  compact?: boolean;
  showCancel?: boolean;
}

async function readErrorMessage(response: Response) {
  try {
    const payload = (await response.json()) as { error?: string };
    if (payload?.error) {
      return payload.error;
    }
  } catch {
    // ignore non-json error body
  }

  return `请求失败 (${response.status})`;
}

export function InstanceWindowsManualBootstrapView({
  onCreated,
  onCancel,
  serverId,
  compact = false,
  showCancel = true,
}: InstanceWindowsManualBootstrapViewProps) {
  const [result, setResult] = useState<WindowsManualBootstrapResponse | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [copyHint, setCopyHint] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleGenerate = async () => {
    setSubmitError(null);
    setCopyHint(null);
    setIsSubmitting(true);

    try {
      const response = await fetch("/api/cf/server/windows/manual-bootstrap", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(serverId ? { serverId } : {}),
      });

      if (!response.ok) {
        setSubmitError(await readErrorMessage(response));
        return;
      }

      const payload = (await response.json()) as WindowsManualBootstrapResponse;
      setResult(payload);
      onCreated?.({ id: payload.id });
    } catch (error) {
      setSubmitError(error instanceof Error ? error.message : "生成启动命令失败");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCopy = async () => {
    if (!result?.command) {
      return;
    }

    try {
      await navigator.clipboard.writeText(result.command);
      setCopyHint("已复制启动命令");
    } catch (error) {
      setCopyHint(error instanceof Error ? error.message : "复制失败，请手动复制");
    }
  };

  return (
    <div className="w-full min-w-0 space-y-5 overflow-hidden">
      {!compact ? (
        <Alert className="min-w-0 overflow-hidden">
          <MonitorCog className="size-4" />
          <AlertDescription className="min-w-0 whitespace-normal break-words">
            <p>适用于没有公网 IP 的 Windows 主机。</p>
            <p>先生成命令，再去目标 PowerShell 粘贴执行。</p>
            <p>脚本会下载 `gomtm.exe`，注入实例环境变量并后台启动 `gomtm server --auto-upgrade`。</p>
          </AlertDescription>
        </Alert>
      ) : null}

      {submitError ? (
        <Alert variant="destructive">
          <AlertDescription>{submitError}</AlertDescription>
        </Alert>
      ) : null}

      {result ? (
        <Field className="min-w-0">
          <FieldLabel className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Windows 启动命令
          </FieldLabel>
          <Textarea
            readOnly
            value={result.command}
            rows={4}
            className="min-w-0 font-mono text-xs [overflow-wrap:anywhere]"
          />
          <FieldDescription className="min-w-0 whitespace-normal break-words">
            <span className="block">目标主机在 PowerShell 里粘贴执行即可。</span>
            <span className="block">实例域名：{result.hostname}</span>
            {result.expires_at ? (
              <span className="block">命令有效期至 {new Date(result.expires_at).toLocaleString()}</span>
            ) : null}
          </FieldDescription>
        </Field>
      ) : (
        <div className="min-w-0 rounded-lg border bg-muted/20 p-4 text-sm text-muted-foreground">
          {serverId
            ? "重新生成这台 Windows 实例的启动命令。"
            : "创建一台 Windows 手动引导实例，并生成 `irm ... | iex` 一键启动命令。"}
        </div>
      )}

      {copyHint ? <div className="text-xs text-muted-foreground">{copyHint}</div> : null}

      <div className="flex flex-wrap justify-end gap-3 border-t pt-4">
        {showCancel && onCancel ? (
          <Button variant="ghost" onClick={onCancel}>
            {result ? "关闭" : "取消"}
          </Button>
        ) : null}
        {result ? (
          <Button variant="outline" onClick={handleCopy}>
            复制启动命令
          </Button>
        ) : null}
        <Button onClick={handleGenerate} disabled={isSubmitting} className="min-w-[140px]">
          {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
          {isSubmitting ? "生成中..." : result ? "重新生成启动命令" : "生成启动命令"}
        </Button>
      </div>
    </div>
  );
}
