"use client";

import { DashContent, DashHeaders } from "@/components/dash-layout";
import { TaskListView } from "@/components/tasks/task-list-view";

export default function Page() {
  return (
    <>
      <DashHeaders>
        <div className="flex flex-col">
          <h1 className="text-lg font-semibold">任务</h1>
          <p className="text-xs text-muted-foreground">统一任务管理面板</p>
        </div>
      </DashHeaders>
      <DashContent className="flex-1 overflow-auto p-4">
        <TaskListView />
      </DashContent>
    </>
  );
}
