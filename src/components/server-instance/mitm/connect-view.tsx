"use client";

import { Check, Copy } from "lucide-react";
import { Button } from "mtxuilib/ui/button";
import { Input } from "mtxuilib/ui/input";
import { Label } from "mtxuilib/ui/label";
import { useState } from "react";
import QRCode from "react-qr-code";
import { toast } from "sonner";

interface ConnectViewProps {
  endpoint: string;
}

export function ConnectView({ endpoint }: ConnectViewProps) {
  const [copied, setCopied] = useState(false);

  if (!endpoint) return null;
  const baseUrl = endpoint.replace(/\/$/, "");
  const subUrl = `${baseUrl}/api/mproxy/sub`;
  const crtUrl = `${baseUrl}/api/mproxy/crt`;

  return (
    <div className="flex flex-col gap-6 py-4 px-6">
      <div className="flex flex-col gap-2">
        <Label htmlFor="link">订阅地址 (Subscription)</Label>
        <div className="flex items-center space-x-2">
          <Input id="link" value={subUrl} readOnly className="font-mono text-xs h-9 bg-slate-50 border-slate-200" />
          <Button
            size="sm"
            type="button"
            className="px-3"
            onClick={() => {
              navigator.clipboard.writeText(subUrl);
              setCopied(true);
              toast.success("订阅链接已复制");
              setTimeout(() => setCopied(false), 2000);
            }}
          >
            {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
          </Button>
        </div>

        <div className="mt-4 flex justify-center p-4 bg-white rounded-lg border w-full max-w-[200px] mx-auto aspect-square">
          <div className="h-full w-full">
            <QRCode
              value={subUrl}
              size={256}
              style={{ height: "auto", maxWidth: "100%", width: "100%" }}
              viewBox={`0 0 256 256`}
            />
          </div>
        </div>

        <p className="text-xs text-muted-foreground mt-2 text-center text-balance leading-relaxed">
          支持 Shadowrocket / v2rayNG / Karing 等客户端。
        </p>
      </div>

      <div className="flex flex-col gap-2 border-t pt-4">
        <Label>CA 证书</Label>
        <p className="text-[11px] text-muted-foreground mb-2">
          您必须在设备上安装并信任此 CA 证书，才能启用 HTTPS 解析。
        </p>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" asChild className="w-full sm:w-auto text-xs h-8">
            <a href={crtUrl} target="_blank" rel="noopener noreferrer" className="gap-2">
              下载 CA 证书
            </a>
          </Button>
        </div>
      </div>
    </div>
  );
}
