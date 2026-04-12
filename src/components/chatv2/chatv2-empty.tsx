"use client";

import { RobotIcon } from "@phosphor-icons/react";
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "mtxuilib/ui/empty";

export function Chatv2Empty() {
  return (
    <div className="h-full flex items-center justify-center flex-1">
      <Empty>
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <RobotIcon className="h-12 w-12" />
          </EmptyMedia>
          <EmptyTitle>欢迎使用聊天机器人</EmptyTitle>
          <EmptyDescription>您可以直接输入消息进行对话</EmptyDescription>
        </EmptyHeader>
      </Empty>
    </div>
  );
}
