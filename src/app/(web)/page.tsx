import {
  ArrowRight,
  Bot,
  Cable,
  CheckCircle2,
  Download,
  Layers3,
  MonitorSmartphone,
  Orbit,
  ScanLine,
  ShieldCheck,
  Smartphone,
  Sparkles,
  Waypoints,
} from "lucide-react";
import { Button } from "mtxuilib/ui/button";
import Link from "next/link";
import { HomepageDownloadCard } from "../../components/site/homepage-download-card";
import { SiteHeader } from "../../components/site/site-header";
import { HOMEPAGE_APK_PATH, loadHomepageDownloadMeta, resolveHomepageDownloadQrUrl } from "./homepage-download";

export default function Page() {
  const downloadMeta = loadHomepageDownloadMeta();
  const downloadAvailable = downloadMeta !== null;
  const qrUrl = downloadAvailable ? resolveHomepageDownloadQrUrl() : null;

  return (
    <div className="min-h-screen overflow-x-hidden bg-[#050816] pb-24 text-white md:pb-0">
      <SiteHeader />

      <main className="flex-1">
        <section className="relative overflow-hidden border-b border-white/10">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,_rgba(34,211,238,0.16),_transparent_30%),radial-gradient(circle_at_80%_20%,_rgba(59,130,246,0.18),_transparent_24%),linear-gradient(180deg,_rgba(5,8,22,0.98),_rgba(5,8,22,1))]" />
          <div className="absolute inset-x-0 top-0 h-[420px] bg-[linear-gradient(90deg,rgba(34,211,238,0.10)_1px,transparent_1px),linear-gradient(180deg,rgba(34,211,238,0.08)_1px,transparent_1px)] bg-[size:36px_36px] opacity-20" />

          <div className="container relative mx-auto px-4 py-14 md:px-6 md:py-20">
            <div className="grid items-center gap-10 lg:grid-cols-[minmax(0,1fr)_420px] xl:grid-cols-[minmax(0,1fr)_460px]">
              <div className="space-y-8">
                <div className="inline-flex items-center gap-2 rounded-full border border-cyan-400/20 bg-cyan-400/10 px-4 py-1.5 text-sm font-medium text-cyan-100">
                  <Sparkles className="h-4 w-4" />
                  Android 节点 App + Browser Console
                </div>

                <div className="space-y-5">
                  <h1 className="max-w-3xl text-4xl font-semibold tracking-tight text-white sm:text-5xl lg:text-6xl">
                    把手机节点接入 GoMTM
                    <span className="mt-2 block bg-gradient-to-r from-cyan-300 via-sky-200 to-white bg-clip-text text-transparent">
                      在浏览器里完成远程控制与自动化管理
                    </span>
                  </h1>
                  <p className="max-w-2xl text-base leading-7 text-slate-300 sm:text-lg">
                    下载 Android 节点 App，接入 P2P
                    网络，然后在控制台中查看节点状态、打开远程控制入口，并把设备纳入自动化管理流程。
                  </p>
                </div>

                <div className="grid gap-3 sm:grid-cols-3">
                  <HeroSignal
                    icon={<Orbit className="h-4 w-4" />}
                    title="P2P 节点接入"
                    detail="手机安装后即可接入节点网络"
                  />
                  <HeroSignal
                    icon={<MonitorSmartphone className="h-4 w-4" />}
                    title="浏览器远控"
                    detail="在控制台中直接进入远程控制入口"
                  />
                  <HeroSignal
                    icon={<Bot className="h-4 w-4" />}
                    title="自动化控制台"
                    detail="统一查看设备、任务和接入状态"
                  />
                </div>

                <div className="flex flex-col gap-3 sm:flex-row">
                  {downloadAvailable ? (
                    <Link href={HOMEPAGE_APK_PATH} data-testid="homepage-hero-download-link">
                      <Button className="h-12 rounded-2xl bg-cyan-400 px-6 text-base text-slate-950 hover:bg-cyan-300">
                        下载 APK
                        <Download className="ml-2 h-4 w-4" />
                      </Button>
                    </Link>
                  ) : (
                    <Button
                      disabled
                      data-testid="homepage-hero-download-link"
                      className="h-12 rounded-2xl bg-cyan-400 px-6 text-base text-slate-950 opacity-60"
                    >
                      下载位保留中
                      <Download className="ml-2 h-4 w-4" />
                    </Button>
                  )}
                  <Link href="/dash">
                    <Button
                      variant="outline"
                      className="h-12 rounded-2xl border-white/15 bg-white/5 px-6 text-base text-white hover:bg-white/10"
                    >
                      进入控制台
                      <ArrowRight className="ml-2 h-4 w-4" />
                    </Button>
                  </Link>
                </div>

                <div className="grid gap-3 sm:grid-cols-3">
                  <StepChip index="01" text="下载 Android APK" />
                  <StepChip index="02" text="连接你的手机节点" />
                  <StepChip index="03" text="在浏览器里远控与管理" />
                </div>
              </div>

              <div className="space-y-5">
                <div className="rounded-[28px] border border-white/10 bg-white/[0.05] p-5 shadow-[0_24px_100px_rgba(2,8,23,0.45)] backdrop-blur-xl">
                  <div className="mb-4 flex items-center justify-between text-xs uppercase tracking-[0.2em] text-slate-400">
                    <span>Live Console Preview</span>
                    <span className="rounded-full border border-emerald-400/20 bg-emerald-400/10 px-3 py-1 text-emerald-200">
                      Node Ready
                    </span>
                  </div>
                  <div className="grid gap-4 md:grid-cols-[148px_minmax(0,1fr)]">
                    <div className="rounded-[24px] border border-cyan-400/15 bg-slate-950/70 p-4">
                      <div className="mb-4 rounded-[20px] border border-white/10 bg-gradient-to-b from-slate-800 to-slate-950 p-3 shadow-inner">
                        <div className="space-y-3 rounded-[18px] border border-white/5 bg-slate-950/90 px-3 py-4">
                          <div className="mx-auto h-16 w-16 rounded-2xl border border-cyan-400/20 bg-cyan-400/10" />
                          <div className="space-y-2 text-center">
                            <p className="text-sm font-medium text-white">GoMTM Android Host</p>
                            <p className="text-xs text-slate-400">Host online</p>
                          </div>
                          <div className="space-y-2 rounded-2xl border border-white/5 bg-white/[0.03] p-3 text-xs text-slate-300">
                            <div className="flex items-center justify-between">
                              <span>Host State</span>
                              <span className="text-emerald-300">Ready</span>
                            </div>
                            <div className="flex items-center justify-between">
                              <span>Transport</span>
                              <span className="text-cyan-200">P2P</span>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="space-y-3">
                      <VisualPanel
                        icon={<Waypoints className="h-4 w-4 text-cyan-200" />}
                        title="P2P 节点发现"
                        detail="浏览器控制台识别在线节点、状态和远控入口。"
                      />
                      <VisualPanel
                        icon={<MonitorSmartphone className="h-4 w-4 text-cyan-200" />}
                        title="远程控制入口"
                        detail="进入设备详情后可直接发起浏览器侧远程控制。"
                      />
                      <VisualPanel
                        icon={<Layers3 className="h-4 w-4 text-cyan-200" />}
                        title="自动化管理"
                        detail="把节点、控制台和任务入口收敛到同一套工作流。"
                      />
                    </div>
                  </div>
                </div>

                <HomepageDownloadCard
                  meta={downloadMeta}
                  downloadPath={downloadAvailable ? HOMEPAGE_APK_PATH : null}
                  qrUrl={qrUrl}
                  title={downloadAvailable ? "立即下载最新 Android 安装包" : "Android 安装位暂时保留"}
                  description={
                    downloadAvailable
                      ? "当前首页默认分发体积更小的 arm64 安装包。桌面端可直接扫码，手机端可立即下载安装。"
                      : "首页暂不提供公开 APK 下载，但会继续保留 Android 节点安装位与控制台入口。"
                  }
                  compact
                  testId="homepage-download-card"
                />
              </div>
            </div>
          </div>
        </section>

        <section className="border-b border-white/10 bg-slate-950/70 py-6">
          <div className="container mx-auto grid gap-3 px-4 md:grid-cols-4 md:px-6">
            <InstallStrip
              title="Android APK"
              detail="最新安装包已同步到首页公开路径"
              icon={<Smartphone className="h-4 w-4" />}
            />
            <InstallStrip title="直接下载" detail="手机访问时可直接下载安装" icon={<Download className="h-4 w-4" />} />
            <InstallStrip
              title="扫码下载"
              detail="桌面端可用二维码把安装包发到手机"
              icon={<ScanLine className="h-4 w-4" />}
            />
            <InstallStrip
              title="浏览器控制台"
              detail="安装后直接在浏览器中管理设备与入口"
              icon={<Cable className="h-4 w-4" />}
            />
          </div>
        </section>

        <section id="capabilities" className="border-b border-white/10 bg-[#07101f] py-20">
          <div className="container mx-auto space-y-12 px-4 md:px-6">
            <div className="max-w-2xl space-y-4">
              <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-1.5 text-xs uppercase tracking-[0.24em] text-slate-300">
                Product Focus
              </div>
              <h2 className="text-3xl font-semibold tracking-tight text-white md:text-4xl">
                围绕两条当前主线，直接讲清产品价值
              </h2>
              <p className="text-base leading-7 text-slate-300">
                新首页不再铺满泛化功能，而是只保留真正影响当前产品理解与转化的两组能力：`P2P 远控` 和 `自动化控制台`。
              </p>
            </div>

            <div className="grid gap-6 lg:grid-cols-2">
              <CapabilityCard
                icon={<Orbit className="h-5 w-5 text-cyan-200" />}
                eyebrow="P2P 远控"
                title="让手机节点先接入，再在浏览器里打开远程控制入口"
                description="首页直接说明产品主路径：安装 Android 节点 App、接入 P2P 网络、在浏览器控制台中识别节点并进入远控界面。"
                bullets={[
                  "聚焦节点接入、节点发现和浏览器侧控制入口",
                  "把“手机安装后能做什么”讲清楚，而不是停留在抽象平台口号",
                  "更适合当前 P2P 远控产品形态",
                ]}
              />
              <CapabilityCard
                icon={<Bot className="h-5 w-5 text-cyan-200" />}
                eyebrow="自动化控制台"
                title="把设备、状态、任务入口和后续自动化能力收敛到同一个控制台"
                description="首页不再泛讲 AI，而是更直接地强调控制台的角色：统一进入设备管理、状态查看和自动化管理入口。"
                bullets={[
                  "设备接入后不需要切换到第二个系统理解产品结构",
                  "控制台成为浏览器侧的统一操作面",
                  "为后续任务与工作流扩展留下明确产品叙事",
                ]}
              />
            </div>
          </div>
        </section>

        <section className="border-b border-white/10 bg-[#050b17] py-20">
          <div className="container mx-auto px-4 md:px-6">
            <div className="grid gap-6 md:grid-cols-3">
              <HowItWorksCard
                step="1"
                title="下载 APK"
                description="直接从首页下载 Android 安装包，或在桌面端扫码把安装包发到手机。"
              />
              <HowItWorksCard
                step="2"
                title="连接节点"
                description="安装后把手机节点接入 GoMTM 的节点网络，让控制台可以识别它。"
              />
              <HowItWorksCard
                step="3"
                title="远控与管理"
                description="在浏览器控制台中查看节点状态、进入远程控制入口，并承接后续自动化管理。"
              />
            </div>
          </div>
        </section>

        <section id="download" className="border-b border-white/10 bg-slate-950 py-20">
          <div className="container mx-auto grid gap-8 px-4 md:px-6 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)] lg:items-start">
            <div className="space-y-5">
              <div className="inline-flex items-center gap-2 rounded-full border border-cyan-400/15 bg-cyan-400/10 px-4 py-1.5 text-xs uppercase tracking-[0.24em] text-cyan-100">
                Download
              </div>
              <h2 className="text-3xl font-semibold tracking-tight text-white md:text-4xl">下载最新 Android 安装包</h2>
              <p className="max-w-xl text-base leading-7 text-slate-300">
                手机访问时直接下载安装，桌面访问时可扫码把安装包发送到手机。当前首页默认提供体积更小的 arm64
                安装包，适合绝大多数 Android 手机。
              </p>

              <div className="space-y-3 text-sm text-slate-300">
                <FaqRow title="如何安装？" detail="下载 APK 后在 Android 手机上完成安装即可。" />
                <FaqRow title="安装后做什么？" detail="把节点接入 GoMTM，然后回到浏览器控制台查看节点和远控入口。" />
                <FaqRow
                  title="为什么首页同时有 App 和控制台？"
                  detail="App 负责接入节点，浏览器控制台负责远控与自动化管理，两者本来就是同一条产品主链路。"
                />
              </div>
            </div>

            <HomepageDownloadCard
              meta={downloadMeta}
              downloadPath={downloadAvailable ? HOMEPAGE_APK_PATH : null}
              qrUrl={qrUrl}
              title={downloadAvailable ? "固定公开地址，直接下载或扫码分发" : "下载组件保留，直链暂不开放"}
              description={
                downloadAvailable
                  ? "下载按钮和二维码都只指向同一个 APK 地址，便于在移动端与桌面端之间保持一致的安装链路。"
                  : "首页组件继续保留，但当前没有公开 APK 元数据，因此不再提供真实下载与扫码分发。"
              }
            />
          </div>
        </section>
      </main>

      <footer className="border-t border-white/10 bg-[#040812] py-10">
        <div className="container mx-auto flex flex-col gap-6 px-4 text-sm text-slate-400 md:flex-row md:items-center md:justify-between md:px-6">
          <div className="space-y-2">
            <p className="text-base font-medium text-white">GoMTM</p>
            <p>Android 节点接入、浏览器远控与自动化控制台入口。</p>
          </div>
          <div className="flex flex-wrap items-center gap-4 text-sm text-slate-300">
            {downloadAvailable ? (
              <Link href={HOMEPAGE_APK_PATH} className="hover:text-white">
                下载 APK
              </Link>
            ) : (
              <span className="text-slate-500">下载位保留中</span>
            )}
            <Link href="/dash" className="hover:text-white">
              进入控制台
            </Link>
            <Link href="/features" className="hover:text-white">
              查看能力
            </Link>
          </div>
        </div>
      </footer>

      <div
        data-testid="homepage-mobile-download-bar"
        className="fixed inset-x-0 bottom-0 z-40 border-t border-white/10 bg-slate-950/95 px-4 py-3 backdrop-blur md:hidden"
      >
        <div className="mx-auto flex max-w-3xl items-center justify-between gap-3">
          <div className="min-w-0">
            <p className="text-sm font-medium text-white">最新 Android 安装包</p>
            <p className="truncate text-xs text-slate-400">
              {downloadAvailable ? "直接下载后即可开始节点接入" : "首页暂不提供公开下载，先进入控制台即可"}
            </p>
          </div>
          {downloadAvailable ? (
            <Link href={HOMEPAGE_APK_PATH}>
              <Button className="h-10 rounded-2xl bg-cyan-400 px-4 text-slate-950 hover:bg-cyan-300">下载 APK</Button>
            </Link>
          ) : (
            <Button disabled className="h-10 rounded-2xl bg-cyan-400 px-4 text-slate-950 opacity-60">
              下载位保留中
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}

function HeroSignal({ icon, title, detail }: { icon: React.ReactNode; title: string; detail: string }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-4 text-left shadow-[0_12px_30px_rgba(2,8,23,0.18)]">
      <div className="mb-3 inline-flex h-9 w-9 items-center justify-center rounded-xl border border-cyan-400/20 bg-cyan-400/10 text-cyan-100">
        {icon}
      </div>
      <div className="space-y-1.5">
        <p className="font-medium text-white">{title}</p>
        <p className="text-sm leading-6 text-slate-400">{detail}</p>
      </div>
    </div>
  );
}

function StepChip({ index, text }: { index: string; text: string }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-slate-950/50 px-4 py-3 text-sm text-slate-200">
      <span className="mr-3 text-xs font-medium uppercase tracking-[0.2em] text-cyan-200">{index}</span>
      {text}
    </div>
  );
}

function VisualPanel({ icon, title, detail }: { icon: React.ReactNode; title: string; detail: string }) {
  return (
    <div className="rounded-3xl border border-white/10 bg-white/[0.04] p-4">
      <div className="mb-3 flex items-center gap-2 text-sm font-medium text-white">
        {icon}
        <span>{title}</span>
      </div>
      <p className="text-sm leading-6 text-slate-400">{detail}</p>
    </div>
  );
}

function InstallStrip({ icon, title, detail }: { icon: React.ReactNode; title: string; detail: string }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-4 shadow-[0_10px_30px_rgba(2,8,23,0.15)]">
      <div className="mb-2 flex items-center gap-2 text-sm font-medium text-white">
        <span className="text-cyan-200">{icon}</span>
        <span>{title}</span>
      </div>
      <p className="text-sm leading-6 text-slate-400">{detail}</p>
    </div>
  );
}

function CapabilityCard({
  icon,
  eyebrow,
  title,
  description,
  bullets,
}: {
  icon: React.ReactNode;
  eyebrow: string;
  title: string;
  description: string;
  bullets: string[];
}) {
  return (
    <div className="rounded-[30px] border border-white/10 bg-white/[0.05] p-6 shadow-[0_24px_80px_rgba(2,8,23,0.24)]">
      <div className="mb-6 flex items-center gap-2 text-sm font-medium text-cyan-100">
        <span className="inline-flex h-10 w-10 items-center justify-center rounded-2xl border border-cyan-400/15 bg-cyan-400/10">
          {icon}
        </span>
        <span>{eyebrow}</span>
      </div>
      <div className="space-y-4">
        <h3 className="text-2xl font-semibold tracking-tight text-white">{title}</h3>
        <p className="text-sm leading-7 text-slate-300">{description}</p>
        <div className="space-y-3 border-t border-white/10 pt-5">
          {bullets.map((bullet) => (
            <div key={bullet} className="flex items-start gap-3 text-sm leading-6 text-slate-300">
              <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-cyan-200" />
              <span>{bullet}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function HowItWorksCard({ step, title, description }: { step: string; title: string; description: string }) {
  return (
    <div className="rounded-[28px] border border-white/10 bg-white/[0.04] p-6 shadow-[0_18px_50px_rgba(2,8,23,0.24)]">
      <div className="mb-4 inline-flex h-10 w-10 items-center justify-center rounded-2xl border border-cyan-400/20 bg-cyan-400/10 text-sm font-semibold text-cyan-100">
        {step}
      </div>
      <div className="space-y-3">
        <h3 className="text-xl font-semibold text-white">{title}</h3>
        <p className="text-sm leading-7 text-slate-400">{description}</p>
      </div>
    </div>
  );
}

function FaqRow({ title, detail }: { title: string; detail: string }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-4">
      <div className="mb-2 flex items-center gap-2 text-sm font-medium text-white">
        <ShieldCheck className="h-4 w-4 text-cyan-200" />
        <span>{title}</span>
      </div>
      <p className="text-sm leading-6 text-slate-400">{detail}</p>
    </div>
  );
}
