"use client";

import {
  Bot,
  CheckCircle2,
  Cloud,
  Code,
  Database,
  Globe,
  Lock,
  Network,
  Server,
  Shield,
  Terminal,
  Zap,
} from "lucide-react";
import { Button } from "mtxuilib/ui/button";
import Link from "next/link";
import { SiteHeader } from "../../../components/site/site-header";

export default function FeaturesPage() {
  return (
    <div className="min-h-screen flex flex-col bg-background text-foreground">
      <SiteHeader />

      <main className="flex-1">
        {/* Hero Section */}
        <section className="relative py-20 md:py-32 overflow-hidden">
          <div className="container px-4 md:px-6 relative z-10 mx-auto">
            <div className="flex flex-col items-center text-center space-y-8 max-w-4xl mx-auto">
              <h1 className="text-4xl md:text-6xl font-extrabold tracking-tight">
                强大的功能，<span className="text-primary">无限的可能</span>
              </h1>
              <p className="max-w-[700px] text-lg text-muted-foreground md:text-xl">
                GoMTM 集成了 AI 智能体编排、沙盒环境、网络流量分析等多项核心能力，为您的开发与运维工作提供全方位支持。
              </p>
            </div>
          </div>
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] bg-primary/10 rounded-full blur-3xl -z-10" />
        </section>

        {/* AI Agent Section */}
        <section className="py-20 bg-slate-50 dark:bg-slate-900/50">
          <div className="container px-4 md:px-6 mx-auto">
            <div className="grid md:grid-cols-2 gap-12 items-center">
              <div className="space-y-6">
                <div className="inline-flex items-center rounded-full border px-3 py-1 text-xs font-semibold bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20">
                  <Bot className="mr-2 h-3 w-3" />
                  AI Agent 编排
                </div>
                <h2 className="text-3xl md:text-4xl font-bold tracking-tight">智能化的任务处理引擎</h2>
                <p className="text-muted-foreground text-lg">
                  基于先进的 AI 技术，GoMTM
                  提供了强大的智能体编排能力。通过简单的配置，您可以创建自定义工作流，实现复杂任务的自动化处理。
                </p>
                <ul className="space-y-3">
                  <FeatureListItem text="支持多种 AI 模型集成 (OpenAI, Anthropic, 本地模型)" />
                  <FeatureListItem text="可视化工作流编排与调试" />
                  <FeatureListItem text="实时消息队列与事件驱动架构" />
                </ul>
              </div>
              <div className="bg-gradient-to-br from-blue-500/10 to-purple-500/10 rounded-2xl p-8 border">
                <div className="grid grid-cols-2 gap-4">
                  <FeatureCard icon={<Bot className="h-6 w-6" />} title="智能对话" />
                  <FeatureCard icon={<Zap className="h-6 w-6" />} title="快速响应" />
                  <FeatureCard icon={<Code className="h-6 w-6" />} title="代码生成" />
                  <FeatureCard icon={<Network className="h-6 w-6" />} title="工具调用" />
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Sandbox Section */}
        <section className="py-20">
          <div className="container px-4 md:px-6 mx-auto">
            <div className="grid md:grid-cols-2 gap-12 items-center">
              <div className="order-2 md:order-1 bg-gradient-to-br from-orange-500/10 to-red-500/10 rounded-2xl p-8 border">
                <div className="space-y-4">
                  <div className="flex items-center gap-3 p-4 bg-background/50 rounded-lg border">
                    <Server className="h-8 w-8 text-orange-500" />
                    <div>
                      <div className="font-semibold">隔离沙盒环境</div>
                      <div className="text-sm text-muted-foreground">秒级启动</div>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 p-4 bg-background/50 rounded-lg border">
                    <Globe className="h-8 w-8 text-blue-500" />
                    <div>
                      <div className="font-semibold">全球节点调度</div>
                      <div className="text-sm text-muted-foreground">低延迟访问</div>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 p-4 bg-background/50 rounded-lg border">
                    <Terminal className="h-8 w-8 text-green-500" />
                    <div>
                      <div className="font-semibold">远程终端访问</div>
                      <div className="text-sm text-muted-foreground">实时交互</div>
                    </div>
                  </div>
                </div>
              </div>
              <div className="order-1 md:order-2 space-y-6">
                <div className="inline-flex items-center rounded-full border px-3 py-1 text-xs font-semibold bg-orange-500/10 text-orange-600 dark:text-orange-400 border-orange-500/20">
                  <Server className="mr-2 h-3 w-3" />
                  沙盒与资源调度
                </div>
                <h2 className="text-3xl md:text-4xl font-bold tracking-tight">安全可靠的运行环境</h2>
                <p className="text-muted-foreground text-lg">
                  提供完全隔离的沙盒环境，支持 Docker
                  容器化部署。您可以在全球范围内调度计算资源，确保应用的高可用性和低延迟。
                </p>
                <ul className="space-y-3">
                  <FeatureListItem text="支持自定义 VPS 节点接入" />
                  <FeatureListItem text="自动化的容器生命周期管理" />
                  <FeatureListItem text="实时状态监控与心跳检测" />
                  <FeatureListItem text="灵活的资源配额与计费策略" />
                </ul>
              </div>
            </div>
          </div>
        </section>

        {/* MITM Section */}
        <section className="py-20 bg-slate-50 dark:bg-slate-900/50">
          <div className="container px-4 md:px-6 mx-auto">
            <div className="grid md:grid-cols-2 gap-12 items-center">
              <div className="space-y-6">
                <div className="inline-flex items-center rounded-full border px-3 py-1 text-xs font-semibold bg-green-500/10 text-green-600 dark:text-green-400 border-green-500/20">
                  <Shield className="mr-2 h-3 w-3" />
                  网络流量分析
                </div>
                <h2 className="text-3xl md:text-4xl font-bold tracking-tight">深入洞察网络请求</h2>
                <p className="text-muted-foreground text-lg">
                  集成的 MITM (中间人) 代理工具，支持 HTTP/HTTPS 流量拦截与分析。无论是移动端还是桌面端，都能轻松接入。
                </p>
                <ul className="space-y-3">
                  <FeatureListItem text="支持 Sing-box / VMess / Shadowsocks 协议" />
                  <FeatureListItem text="自动 CA 证书生成与分发" />
                  <FeatureListItem text="实时流量日志与请求/响应查看" />
                  <FeatureListItem text="支持 SQLite 和 Supabase 存储" />
                </ul>
              </div>
              <div className="bg-gradient-to-br from-green-500/10 to-teal-500/10 rounded-2xl p-8 border">
                <div className="space-y-4">
                  <div className="p-4 bg-background/50 rounded-lg border">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm font-mono">GET /api/users</span>
                      <span className="text-xs text-green-600 dark:text-green-400">200 OK</span>
                    </div>
                    <div className="text-xs text-muted-foreground">127.0.0.1:8083</div>
                  </div>
                  <div className="p-4 bg-background/50 rounded-lg border">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm font-mono">POST /auth/login</span>
                      <span className="text-xs text-blue-600 dark:text-blue-400">201 Created</span>
                    </div>
                    <div className="text-xs text-muted-foreground">127.0.0.1:8083</div>
                  </div>
                  <div className="p-4 bg-background/50 rounded-lg border">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm font-mono">DELETE /api/data</span>
                      <span className="text-xs text-orange-600 dark:text-orange-400">204 No Content</span>
                    </div>
                    <div className="text-xs text-muted-foreground">127.0.0.1:8083</div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Additional Features Grid */}
        <section className="py-20">
          <div className="container px-4 md:px-6 mx-auto">
            <div className="text-center mb-16 space-y-4">
              <h2 className="text-3xl font-bold tracking-tighter md:text-4xl">更多强大功能</h2>
              <p className="text-muted-foreground max-w-[600px] mx-auto">
                GoMTM 还提供了一系列开箱即用的功能模块，助力您的业务快速发展。
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              <AdditionalFeatureCard
                icon={<Database className="h-8 w-8 text-cyan-500" />}
                title="数据管理"
                description="基于 Supabase 的实时数据库，支持 RLS 权限控制和自动备份。"
              />
              <AdditionalFeatureCard
                icon={<Lock className="h-8 w-8 text-purple-500" />}
                title="安全认证"
                description="内置用户认证系统，支持多种登录方式和角色权限管理。"
              />
              <AdditionalFeatureCard
                icon={<Cloud className="h-8 w-8 text-blue-500" />}
                title="云端部署"
                description="一键部署到全球 CDN，支持自定义域名和 SSL 证书。"
              />
              <AdditionalFeatureCard
                icon={<Zap className="h-8 w-8 text-yellow-500" />}
                title="高性能"
                description="基于 Go 和 Rust 构建，提供极致的运行速度和资源利用率。"
              />
              <AdditionalFeatureCard
                icon={<Network className="h-8 w-8 text-green-500" />}
                title="WebSocket 实时通信"
                description="支持实时消息推送、日志流式传输和状态同步。"
              />
              <AdditionalFeatureCard
                icon={<Terminal className="h-8 w-8 text-orange-500" />}
                title="开发者友好"
                description="完善的 API 文档、SDK 和 CLI 工具，快速集成到您的项目。"
              />
            </div>
          </div>
        </section>

        {/* CTA Section */}
        <section className="py-20 bg-slate-50 dark:bg-slate-900/50">
          <div className="container px-4 md:px-6 mx-auto">
            <div className="bg-primary text-primary-foreground rounded-3xl p-8 md:p-16 text-center space-y-6">
              <h2 className="text-3xl md:text-4xl font-bold">准备好体验这些功能了吗？</h2>
              <p className="text-primary-foreground/80 max-w-[600px] mx-auto text-lg">
                立即注册 GoMTM，开启您的云端开发之旅。
              </p>
              <div className="flex flex-col sm:flex-row gap-4 justify-center">
                <Link href="/auth/register">
                  <Button size="lg" variant="secondary" className="w-full sm:w-auto">
                    免费开始使用
                  </Button>
                </Link>
                <Link href="/pricing">
                  <Button
                    size="lg"
                    variant="outline"
                    className="w-full sm:w-auto bg-transparent border-primary-foreground/20 text-primary-foreground hover:bg-primary-foreground/10"
                  >
                    查看价格方案
                  </Button>
                </Link>
              </div>
            </div>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="border-t py-12 bg-slate-50 dark:bg-slate-950">
        <div className="container px-4 md:px-6 mx-auto grid grid-cols-2 md:grid-cols-4 gap-8">
          <div className="col-span-2">
            <span className="text-xl font-bold">GoMTM</span>
            <p className="mt-4 text-sm text-muted-foreground max-w-[300px]">
              为开发者打造的终极工具箱。集成 AI、网络、算力资源，赋能您的每一个创意。
            </p>
          </div>
          <div>
            <h4 className="font-semibold mb-4">产品</h4>
            <ul className="space-y-2 text-sm text-muted-foreground">
              <li>
                <Link href="/features" className="hover:text-foreground">
                  功能特性
                </Link>
              </li>
              <li>
                <Link href="/pricing" className="hover:text-foreground">
                  价格方案
                </Link>
              </li>
              <li>
                <Link href="/dash" className="hover:text-foreground">
                  控制台
                </Link>
              </li>
            </ul>
          </div>
          <div>
            <h4 className="font-semibold mb-4">链接</h4>
            <ul className="space-y-2 text-sm text-muted-foreground">
              <li>
                <Link href="#" className="hover:text-foreground">
                  文档中心
                </Link>
              </li>
              <li>
                <Link href="#" className="hover:text-foreground">
                  GitHub
                </Link>
              </li>
              <li>
                <Link href="#" className="hover:text-foreground">
                  关于我们
                </Link>
              </li>
            </ul>
          </div>
        </div>
        <div className="container px-4 md:px-6 mx-auto mt-12 pt-8 border-t text-center text-sm text-muted-foreground">
          © 2026 GoMTM Inc. All rights reserved.
        </div>
      </footer>
    </div>
  );
}

function FeatureListItem({ text }: { text: string }) {
  return (
    <li className="flex items-start gap-3">
      <CheckCircle2 className="h-5 w-5 text-primary mt-0.5 flex-shrink-0" />
      <span className="text-muted-foreground">{text}</span>
    </li>
  );
}

function FeatureCard({ icon, title }: { icon: React.ReactNode; title: string }) {
  return (
    <div className="p-4 bg-background/50 rounded-lg border">
      <div className="mb-2">{icon}</div>
      <div className="text-sm font-semibold">{title}</div>
    </div>
  );
}

function AdditionalFeatureCard({
  icon,
  title,
  description,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
}) {
  return (
    <div className="p-6 bg-background rounded-xl border hover:shadow-md transition-shadow">
      <div className="mb-4">{icon}</div>
      <h3 className="text-lg font-bold mb-2">{title}</h3>
      <p className="text-sm text-muted-foreground">{description}</p>
    </div>
  );
}
