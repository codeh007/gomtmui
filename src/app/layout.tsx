import { fontVariables } from "mtxuilib/fonts/fonts";
import { cn } from "mtxuilib/lib/utils";
import type { Metadata } from "next";

import "@/styles/globals.css";
import "mtxuilib/styles/globals.css";

import { Suspense } from "react";
import { MainProvider } from "@/stores/MainProvider";

const siteConfig = {
  name: "GoMTM",
  url: process.env.NEXT_PUBLIC_SITE_URL || process.env.NEXT_PUBLIC_BASE_URL || "https://gomtmui.example.com",
  ogImage: "/og.svg",
  description: "GoMTM - 内容管理、自动化聊天等功能。",
  links: {
    twitter: "https://twitter.com/gomtm",
    github: "https://github.com/gomtm/gomtm",
  },
};
export const metadata: Metadata = {
  title: {
    default: siteConfig.name,
    template: `%s - ${siteConfig.name}`,
  },
  metadataBase: new URL(siteConfig.url),
  description: siteConfig.description,
  keywords: ["GoMTM", "AI Agent", "自动化", "内容管理"],
  authors: [
    {
      name: "GoMTM Team",
      url: "https://github.com/gomtm/gomtm",
    },
  ],
  creator: "GoMTM Team",
  openGraph: {
    type: "website",
    locale: "zh_CN",
    url: siteConfig.url,
    title: siteConfig.name,
    description: siteConfig.description,
    siteName: siteConfig.name,
    images: [
        {
          url: siteConfig.ogImage,
        width: 1200,
        height: 630,
        alt: siteConfig.name,
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: siteConfig.name,
    description: siteConfig.description,
    images: [siteConfig.ogImage],
    creator: "@gomtm",
  },
  icons: {
    icon: [
      { url: "/favicon.svg", type: "image/svg+xml" },
      { url: "/favicon.ico", type: "image/x-icon" },
    ],
    shortcut: "/favicon.ico",
    apple: "/favicon.ico",
  },
  manifest: "/site.webmanifest",
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={cn("text-foreground group/body overscroll-none font-sans antialiased h-full", fontVariables)}>
        <Suspense fallback={"loading"}>
          <MainProvider>{children}</MainProvider>
        </Suspense>
      </body>
    </html>
  );
}
