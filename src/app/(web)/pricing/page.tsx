"use client";

import { Check, Sparkles } from "lucide-react";
import { Button } from "mtxuilib/ui/button";
import Link from "next/link";
import { SiteHeader } from "../../../components/site/site-header";

export default function PricingPage() {
  return (
    <div className="min-h-screen flex flex-col bg-background text-foreground">
      <SiteHeader />

      <main className="flex-1">
        {/* Hero Section */}
        <section className="relative py-20 md:py-32 overflow-hidden">
          <div className="container px-4 md:px-6 relative z-10 mx-auto">
            <div className="flex flex-col items-center text-center space-y-8 max-w-4xl mx-auto">
              <h1 className="text-4xl md:text-6xl font-extrabold tracking-tight">
                简单透明的<span className="text-primary">价格方案</span>
              </h1>
              <p className="max-w-[700px] text-lg text-muted-foreground md:text-xl">
                无论您是个人开发者还是企业团队，GoMTM 都有适合您的方案。按需付费，随时升级。
              </p>
            </div>
          </div>
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] bg-primary/10 rounded-full blur-3xl -z-10" />
        </section>

        {/* Pricing Cards */}
        <section className="py-20">
          <div className="container px-4 md:px-6 mx-auto">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8 max-w-6xl mx-auto">
              {/* Free Plan */}
              <PricingCard
                name="免费版"
                price="¥0"
                period="永久免费"
                description="适合个人开发者和小型项目"
                features={[
                  "1 个 AI Agent 实例",
                  "2 个沙盒环境",
                  "基础 MITM 流量分析",
                  "10 GB 存储空间",
                  "社区支持",
                  "基础 API 访问",
                ]}
                buttonText="免费开始"
                buttonVariant="outline"
                href="/auth/register"
              />

              {/* Pro Plan */}
              <PricingCard
                name="专业版"
                price="¥99"
                period="每月"
                description="适合专业开发者和中小团队"
                features={[
                  "10 个 AI Agent 实例",
                  "无限沙盒环境",
                  "高级 MITM 流量分析",
                  "100 GB 存储空间",
                  "优先技术支持",
                  "完整 API 访问",
                  "自定义域名",
                  "团队协作功能",
                ]}
                buttonText="开始使用"
                buttonVariant="default"
                href="/auth/register"
                popular
              />

              {/* Enterprise Plan */}
              <PricingCard
                name="企业版"
                price="定制"
                period="联系我们"
                description="适合大型企业和特殊需求"
                features={[
                  "无限 AI Agent 实例",
                  "无限沙盒环境",
                  "企业级 MITM 方案",
                  "无限存储空间",
                  "7x24 专属技术支持",
                  "私有化部署选项",
                  "SLA 保障",
                  "定制开发服务",
                ]}
                buttonText="联系销售"
                buttonVariant="outline"
                href="#contact"
              />
            </div>
          </div>
        </section>

        {/* Feature Comparison */}
        <section className="py-20 bg-slate-50 dark:bg-slate-900/50">
          <div className="container px-4 md:px-6 mx-auto">
            <div className="text-center mb-16 space-y-4">
              <h2 className="text-3xl font-bold tracking-tighter md:text-4xl">功能对比</h2>
              <p className="text-muted-foreground max-w-[600px] mx-auto">
                详细了解各个版本的功能差异，选择最适合您的方案。
              </p>
            </div>

            <div className="max-w-5xl mx-auto overflow-x-auto">
              <table className="w-full border-collapse bg-background rounded-xl overflow-hidden shadow-sm">
                <thead>
                  <tr className="border-b bg-slate-50 dark:bg-slate-900">
                    <th className="text-left p-4 font-semibold">功能</th>
                    <th className="text-center p-4 font-semibold">免费版</th>
                    <th className="text-center p-4 font-semibold">专业版</th>
                    <th className="text-center p-4 font-semibold">企业版</th>
                  </tr>
                </thead>
                <tbody>
                  <ComparisonRow feature="AI Agent 实例" free="1 个" pro="10 个" enterprise="无限" />
                  <ComparisonRow feature="沙盒环境" free="2 个" pro="无限" enterprise="无限" />
                  <ComparisonRow feature="存储空间" free="10 GB" pro="100 GB" enterprise="无限" />
                  <ComparisonRow feature="MITM 流量分析" free="基础" pro="高级" enterprise="企业级" />
                  <ComparisonRow feature="API 访问" free="基础" pro="完整" enterprise="完整 + 定制" />
                  <ComparisonRow feature="技术支持" free="社区" pro="优先" enterprise="7x24 专属" />
                  <ComparisonRow feature="自定义域名" free={false} pro={true} enterprise={true} />
                  <ComparisonRow feature="团队协作" free={false} pro={true} enterprise={true} />
                  <ComparisonRow feature="私有化部署" free={false} pro={false} enterprise={true} />
                  <ComparisonRow feature="SLA 保障" free={false} pro={false} enterprise={true} />
                </tbody>
              </table>
            </div>
          </div>
        </section>

        {/* FAQ Section */}
        <section className="py-20">
          <div className="container px-4 md:px-6 mx-auto">
            <div className="text-center mb-16 space-y-4">
              <h2 className="text-3xl font-bold tracking-tighter md:text-4xl">常见问题</h2>
              <p className="text-muted-foreground max-w-[600px] mx-auto">关于价格和方案的常见问题解答。</p>
            </div>

            <div className="max-w-3xl mx-auto space-y-6">
              <FAQItem
                question="可以随时升级或降级方案吗？"
                answer="是的，您可以随时在控制台中升级或降级您的方案。升级立即生效，降级将在当前计费周期结束后生效。"
              />
              <FAQItem
                question="是否支持按年付费？"
                answer="支持。按年付费可享受 8.5 折优惠。您可以在注册后在控制台中选择年付选项。"
              />
              <FAQItem
                question="如何计费？"
                answer="我们采用预付费模式，每月初自动扣费。您可以绑定信用卡或使用支付宝/微信支付进行充值。"
              />
              <FAQItem
                question="免费版有使用期限吗？"
                answer="没有。免费版永久免费，没有使用期限限制。但我们保留调整免费版配额的权利。"
              />
              <FAQItem
                question="企业版如何定价？"
                answer="企业版根据您的具体需求定制，包括实例数量、存储空间、技术支持等级等。请联系我们的销售团队获取报价。"
              />
              <FAQItem
                question="是否提供退款？"
                answer="如果您在购买后 7 天内不满意，我们提供全额退款。超过 7 天后，我们不提供退款，但您可以随时取消订阅。"
              />
            </div>
          </div>
        </section>

        {/* CTA Section */}
        <section className="py-20 bg-slate-50 dark:bg-slate-900/50">
          <div className="container px-4 md:px-6 mx-auto">
            <div className="bg-primary text-primary-foreground rounded-3xl p-8 md:p-16 text-center space-y-6">
              <h2 className="text-3xl md:text-4xl font-bold">准备好开始了吗？</h2>
              <p className="text-primary-foreground/80 max-w-[600px] mx-auto text-lg">
                立即注册 GoMTM，免费体验所有核心功能。无需信用卡。
              </p>
              <Link href="/auth/register">
                <Button size="lg" variant="secondary">
                  免费开始使用
                </Button>
              </Link>
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

function PricingCard({
  name,
  price,
  period,
  description,
  features,
  buttonText,
  buttonVariant,
  href,
  popular = false,
}: {
  name: string;
  price: string;
  period: string;
  description: string;
  features: string[];
  buttonText: string;
  buttonVariant: "default" | "outline";
  href: string;
  popular?: boolean;
}) {
  return (
    <div
      className={`relative flex flex-col p-8 bg-background rounded-2xl border ${
        popular ? "border-primary shadow-lg scale-105" : "border-border"
      } hover:shadow-xl transition-all`}
    >
      {popular && (
        <div className="absolute -top-4 left-1/2 -translate-x-1/2">
          <div className="inline-flex items-center gap-1 px-3 py-1 bg-primary text-primary-foreground text-xs font-semibold rounded-full">
            <Sparkles className="h-3 w-3" />
            最受欢迎
          </div>
        </div>
      )}

      <div className="mb-6">
        <h3 className="text-2xl font-bold mb-2">{name}</h3>
        <p className="text-sm text-muted-foreground">{description}</p>
      </div>

      <div className="mb-6">
        <div className="flex items-baseline gap-2">
          <span className="text-4xl font-extrabold">{price}</span>
          {price !== "定制" && <span className="text-muted-foreground">/ {period}</span>}
        </div>
        {price === "定制" && <span className="text-sm text-muted-foreground">{period}</span>}
      </div>

      <ul className="space-y-3 mb-8 flex-1">
        {features.map((feature, index) => (
          <li key={index} className="flex items-start gap-3">
            <Check className="h-5 w-5 text-primary mt-0.5 shrink-0" />
            <span className="text-sm text-muted-foreground">{feature}</span>
          </li>
        ))}
      </ul>

      <Link href={href} className="w-full">
        <Button variant={buttonVariant} size="lg" className="w-full">
          {buttonText}
        </Button>
      </Link>
    </div>
  );
}

function ComparisonRow({
  feature,
  free,
  pro,
  enterprise,
}: {
  feature: string;
  free: string | boolean;
  pro: string | boolean;
  enterprise: string | boolean;
}) {
  const renderCell = (value: string | boolean) => {
    if (typeof value === "boolean") {
      return value ? (
        <Check className="h-5 w-5 text-green-500 mx-auto" />
      ) : (
        <span className="text-muted-foreground">—</span>
      );
    }
    return <span className="text-sm">{value}</span>;
  };

  return (
    <tr className="border-b last:border-b-0 hover:bg-slate-50 dark:hover:bg-slate-900/50">
      <td className="p-4 font-medium">{feature}</td>
      <td className="p-4 text-center">{renderCell(free)}</td>
      <td className="p-4 text-center">{renderCell(pro)}</td>
      <td className="p-4 text-center">{renderCell(enterprise)}</td>
    </tr>
  );
}

function FAQItem({ question, answer }: { question: string; answer: string }) {
  return (
    <div className="p-6 bg-background rounded-xl border">
      <h3 className="text-lg font-semibold mb-3">{question}</h3>
      <p className="text-muted-foreground">{answer}</p>
    </div>
  );
}
