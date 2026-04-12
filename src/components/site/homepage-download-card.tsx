"use client";

import { Clock3, Download, QrCode, ScanLine, Smartphone } from "lucide-react";
import { Button } from "mtxuilib/ui/button";
import Link from "next/link";
import QRCode from "react-qr-code";
import type { HomepageDownloadMeta } from "../../app/(web)/homepage-download";

interface HomepageDownloadCardProps {
  meta: HomepageDownloadMeta | null;
  downloadPath: string | null;
  qrUrl: string | null;
  title: string;
  description: string;
  compact?: boolean;
  testId?: string;
}

function formatApkSize(size: number) {
  if (size >= 1024 * 1024 * 1024) {
    return `${(size / (1024 * 1024 * 1024)).toFixed(1)} GB`;
  }

  return `${(size / (1024 * 1024)).toFixed(1)} MB`;
}

function formatUpdatedAt(updatedAt: string) {
  const date = new Date(updatedAt);

  if (Number.isNaN(date.getTime())) {
    return updatedAt;
  }

  return new Intl.DateTimeFormat("zh-CN", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(date);
}

function MetaRow({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm">
      <div className="flex items-center gap-2 text-slate-300">
        {icon}
        <span>{label}</span>
      </div>
      <span className="font-medium text-white">{value}</span>
    </div>
  );
}

export function HomepageDownloadCard({
  meta,
  downloadPath,
  qrUrl,
  title,
  description,
  compact = false,
  testId,
}: HomepageDownloadCardProps) {
  const downloadAvailable = meta !== null && downloadPath !== null;

  return (
    <div
      data-testid={testId}
      data-qr-url={qrUrl ?? ""}
      className={`rounded-[28px] border border-white/10 bg-white/[0.06] p-5 text-white shadow-[0_20px_80px_rgba(3,7,18,0.35)] backdrop-blur-xl ${
        compact ? "space-y-5" : "space-y-6"
      }`}
    >
      <div className="space-y-3">
        <div className="inline-flex items-center gap-2 rounded-full border border-cyan-400/20 bg-cyan-400/10 px-3 py-1 text-xs font-medium text-cyan-100">
          <Smartphone className="h-3.5 w-3.5" />
          Android 节点 App
        </div>
        <div className="space-y-2">
          <h3 className="text-xl font-semibold tracking-tight">{title}</h3>
          <p className="text-sm leading-6 text-slate-300">{description}</p>
        </div>
      </div>

      <div
        className={`grid gap-4 ${compact ? "lg:grid-cols-[minmax(0,1fr)_164px]" : "lg:grid-cols-[minmax(0,1fr)_220px]"}`}
      >
        <div className="space-y-3">
          {downloadAvailable ? (
            <>
              <MetaRow icon={<Download className="h-4 w-4" />} label="文件" value={meta.fileName} />
              <MetaRow icon={<ScanLine className="h-4 w-4" />} label="版本" value={meta.version} />
              <MetaRow icon={<Clock3 className="h-4 w-4" />} label="更新时间" value={formatUpdatedAt(meta.updatedAt)} />
              <MetaRow icon={<Download className="h-4 w-4" />} label="大小" value={formatApkSize(meta.size)} />
              {meta.abi ? <MetaRow icon={<Smartphone className="h-4 w-4" />} label="架构" value={meta.abi} /> : null}
            </>
          ) : (
            <div className="rounded-2xl border border-dashed border-white/10 bg-white/[0.03] p-4 text-sm text-slate-300">
              <p className="font-medium text-white">下载位暂未开放</p>
              <p className="mt-2 leading-6 text-slate-400">
                首页继续保留 Android 节点安装位，但当前没有可公开分发的 APK 元数据，因此不再提供真实下载链接。
              </p>
            </div>
          )}

          <div className="flex flex-col gap-3 sm:flex-row">
            {downloadAvailable ? (
              <Link href={downloadPath} className="sm:flex-1">
                <Button className="h-11 w-full rounded-2xl bg-cyan-400 text-slate-950 hover:bg-cyan-300">
                  下载 APK
                </Button>
              </Link>
            ) : (
              <Button disabled className="h-11 w-full rounded-2xl bg-cyan-400 text-slate-950 opacity-60 sm:flex-1">
                下载位保留中
              </Button>
            )}
            <Link href="/dash" className="sm:flex-1">
              <Button
                variant="outline"
                className="h-11 w-full rounded-2xl border-white/15 bg-white/5 text-white hover:bg-white/10"
              >
                进入控制台
              </Button>
            </Link>
          </div>
        </div>

        <div className="rounded-3xl border border-white/10 bg-slate-950/50 p-4">
          {downloadAvailable && qrUrl ? (
            <div className="space-y-3 text-center">
              <div
                role="img"
                aria-label="APK 下载二维码"
                className="mx-auto flex aspect-square w-full max-w-[160px] items-center justify-center rounded-2xl bg-white p-3"
              >
                <QRCode
                  value={qrUrl}
                  size={compact ? 132 : 180}
                  style={{ height: "auto", maxWidth: "100%", width: "100%" }}
                />
              </div>
              <div className="space-y-1">
                <p className="flex items-center justify-center gap-2 text-sm font-medium text-white">
                  <QrCode className="h-4 w-4" />
                  手机扫码下载
                </p>
                <p className="text-xs leading-5 text-slate-400">桌面端打开时可直接扫码跳转到最新安装包。</p>
              </div>
            </div>
          ) : !downloadAvailable ? (
            <div className="flex h-full flex-col justify-between gap-4 rounded-2xl border border-dashed border-white/10 bg-white/[0.03] p-4 text-sm text-slate-300">
              <div className="space-y-2">
                <p className="font-medium text-white">二维码位保留中</p>
                <p className="leading-6 text-slate-400">
                  当前首页不再提供公开 APK 下载，因此二维码区域只保留展示位，待发布包恢复后会自动切回扫码下载。
                </p>
              </div>
              <p className="text-xs text-slate-500">需要安装位时，可后续重新接回公开分发路径。</p>
            </div>
          ) : (
            <div className="flex h-full flex-col justify-between gap-4 rounded-2xl border border-dashed border-white/10 bg-white/[0.03] p-4 text-sm text-slate-300">
              <div className="space-y-2">
                <p className="font-medium text-white">扫码下载需要公开访问地址</p>
                <p className="leading-6 text-slate-400">
                  当前环境没有提供可被手机访问的公开站点地址，先使用直接下载链接即可。
                </p>
              </div>
              <p className="text-xs text-slate-500">如需扫码，请通过公开域名或服务器 IP 访问此页面。</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
