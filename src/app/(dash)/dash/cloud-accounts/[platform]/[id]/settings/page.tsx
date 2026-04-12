"use client";

import { CloudAccountSettingsPlaceholder } from "@/components/cloud-account/cloud-account-settings-placeholder";

export default function SettingsPage() {
  return (
    <CloudAccountSettingsPlaceholder
      description="Update account configuration."
      sections={[{ title: "General Settings", description: "Settings form coming soon." }]}
    />
  );
}
