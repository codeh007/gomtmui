import { DashContent } from "@/components/dash-layout";
import AccountForm from "./account-form";

export default function ProfilePage() {
  return (
    <DashContent className="flex flex-col gap-6 p-4 md:p-6 overflow-auto">
      <div className="flex flex-col border-b pb-4">
        <h1 className="text-lg font-semibold">个人资料</h1>
        <p className="text-xs text-muted-foreground">管理您的个人信息和头像</p>
      </div>

      <AccountForm />
    </DashContent>
  );
}
