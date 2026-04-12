"use client";

import { Plus } from "lucide-react";
import { Button } from "mtxuilib/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "mtxuilib/ui/dialog";
import { useState } from "react";
import { AddModelView } from "./AddModelView";
import { ModelList } from "./ModelList";

export const ModelListView = () => {
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">AI 模型配置</h2>
          <p className="text-muted-foreground">管理您的AI模型配置和API凭据。</p>
        </div>
        <Button onClick={() => setIsAddModalOpen(true)} className="flex items-center gap-2">
          <Plus className="size-4" />
          添加模型
        </Button>
      </div>

      <div className="mt-4">
        <ModelList />
      </div>

      <Dialog open={isAddModalOpen} onOpenChange={setIsAddModalOpen}>
        <DialogContent className="sm:max-w-md p-0 overflow-hidden">
          <DialogHeader className="p-6 pb-0">
            <DialogTitle>添加模型配置</DialogTitle>
          </DialogHeader>
          <AddModelView
            onSuccess={() => {
              setIsAddModalOpen(false);
            }}
            onCancel={() => setIsAddModalOpen(false)}
          />
        </DialogContent>
      </Dialog>
    </div>
  );
};
