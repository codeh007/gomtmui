import { requireAdminSettingsAccess } from "../require-admin";
import { SystemSettingsContent } from "./system-settings-content";

export default async function SystemSettingsPage() {
  await requireAdminSettingsAccess();
  return <SystemSettingsContent />;
}
