import { ErrorBoundary } from "@/components/common/error-boundary";
import { DashContent } from "@/components/dash-layout";
import { GithubAppCard } from "@/components/github/github-app-card";
import { requireAdminSettingsAccess } from "../require-admin";

export default async function IntegrationsSettingsPage() {
  await requireAdminSettingsAccess();

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
