"use client";

import { cn } from "mtxuilib/lib/utils";
// import QRCode from "react-qr-code";
import { ChatContainerContent, ChatContainerRoot } from "mtxuilib/prompt-kit/chat-container";
import { ScrollButton } from "mtxuilib/prompt-kit/scroll-button";
import { useRef } from "react";
import { ChatUIMessage } from "./chat-ui-message";
import { Chatv2Empty } from "./chatv2-empty";
import { Chatv2PromptInput } from "./chatv2-prompt-input";
import { useMtAgentChat } from "./hooks/useMtAgentChat";

interface ChatbotAgentViewProps {
  sessionId: string;
}

export const Chatv2 = ({ sessionId }: ChatbotAgentViewProps) => {
  const chatContainerRef = useRef<HTMLDivElement>(null);

  const chatAgent = useMtAgentChat({ sessionId });

  return (
    <main className={cn("flex h-screen flex-col overflow-hidden")}>
      {/* <Chatv2Header chatAgent={chatAgent} /> */}
      <div ref={chatContainerRef} className={cn("relative flex-1 overflow-y-auto")}>
        <ChatContainerRoot className={cn("h-full")}>
          {/* <Chatv2Content messages={chatAgent.messages} /> */}
          <ChatContainerContent
            className={cn(
              "space-y-0 px-3 py-6",
              "max-w-3xl", //增加宽度限制,
              "mx-auto",
              "gap-2",
            )}
          >
            {chatAgent.messages.length === 0 && <Chatv2Empty />}
            {chatAgent.messages.map((message) => (
              <ChatUIMessage key={message.id} uiMessage={message} />
            ))}
          </ChatContainerContent>

          <div className="absolute bottom-4 left-1/2 flex w-full max-w-3xl -translate-x-1/2 justify-end px-5">
            <ScrollButton className="shadow-sm" />
          </div>
        </ChatContainerRoot>
      </div>
      <div className="bg-background z-10 shrink-0 px-3 pb-3 md:px-5 md:pb-5">
        <div className="mx-auto max-w-3xl">
          <Chatv2PromptInput
            onSubmit={(msg) => {
              chatAgent.handlerUserInput(msg);
            }}
          />
        </div>
      </div>
    </main>
  );
};
