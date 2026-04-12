"use client";

import { ErrorBoundary } from "@/components/common/error-boundary";
import { DashContent } from "@/components/dash-layout";
import { GithubAppCard } from "@/components/github/github-app-card";

export default function IntegrationsSettingsPage() {
  return (
    <DashContent className="overflow-auto">
      <div className="flex flex-col gap-6 p-4 md:p-6">
        <ErrorBoundary name="GithubAppCard">
          <GithubAppCard />
        </ErrorBoundary>
      </div>
    </DashContent>
  );
}
