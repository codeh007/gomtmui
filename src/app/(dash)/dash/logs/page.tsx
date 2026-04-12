import { DashContent, DashHeaders } from "@/components/dash-layout";
import { SystemLogView } from "@/components/system_log/system_log_view";

export default function Page() {
  return (
    <>
      <DashHeaders>
        <div className="flex flex-col">
          <h1 className="text-lg font-semibold">日志</h1>
          <p className="text-xs text-muted-foreground">事件和操作记录</p>
        </div>
      </DashHeaders>
      <DashContent className="flex-1 overflow-auto">
        <SystemLogView />
      </DashContent>
    </>
  );
}
