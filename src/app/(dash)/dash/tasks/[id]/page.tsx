import { use } from "react";
import { DashContent, DashHeaders } from "@/components/dash-layout";
import { TaskDetailView } from "@/components/tasks/task-detail-view";

export default function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);

  return (
    <>
      <DashHeaders>
        <div className="flex flex-col">
          <h1 className="text-lg font-semibold">任务详情</h1>
          <p className="text-xs text-muted-foreground font-mono">{id}</p>
        </div>
      </DashHeaders>
      <DashContent className="flex-1 overflow-auto p-4 bg-muted/10">
        <TaskDetailView id={id} />
      </DashContent>
    </>
  );
}
