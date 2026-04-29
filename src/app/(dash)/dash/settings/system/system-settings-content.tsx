"use client";

import { ErrorBoundary } from "@/components/common/error-boundary";
import { DashContent } from "@/components/dash-layout";
import { CloudflareConfigCard } from "./cloudflare-config-card";
import { SmsProviderConfigCard } from "./sms-provider-config-card";
import { SupabaseConfigCard } from "./supabase-config-card";

export function SystemSettingsContent() {
  return (
    <DashContent className="flex flex-col gap-6 p-4 md:p-6 overflow-auto">
      <div className="flex w-full max-w-4xl flex-col gap-6 mr-auto">
        <ErrorBoundary name="SupabaseConfigCard">
          <SupabaseConfigCard />
        </ErrorBoundary>

        <ErrorBoundary name="CloudflareConfigCard">
          <CloudflareConfigCard />
        </ErrorBoundary>

        <ErrorBoundary name="SmsProviderConfigCard">
          <SmsProviderConfigCard />
        </ErrorBoundary>
      </div>
    </DashContent>
  );
}
