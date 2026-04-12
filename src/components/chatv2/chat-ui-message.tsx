"use client";

import type { UIMessage } from "ai";
import { DebugValue, OnlyDebug } from "mtxuilib/mt/DebugValue";
import { Message, MessageActions, MessageAvatar, MessageContent } from "mtxuilib/prompt-kit/message";
import { Fragment } from "react";

type MessagePart = UIMessage["parts"][number];

function renderUserPart(part: MessagePart) {
  if (part.type === "text") {
    return <MessageContent className="bg-primary text-primary-foreground">{part.text}</MessageContent>;
  }

  if (part.type === "step-start") {
    return null;
  }

  return (
    <OnlyDebug>
      Unknown Part <DebugValue data={part} />
    </OnlyDebug>
  );
}

function renderAssistantPart(part: MessagePart) {
  if (part.type === "text") {
    return (
      <MessageContent className="bg-transparent p-0 text-foreground prose" markdown>
        {part.text}
      </MessageContent>
    );
  }

  if (part.type === "step-start") {
    return null;
  }

  if (part.type === "data-actions") {
    return (
      <MessageActions className="self-end">
        <OnlyDebug>
          Data actions <DebugValue data={part} />
        </OnlyDebug>
      </MessageActions>
    );
  }

  if (typeof part.type === "string" && part.type.startsWith("tool-")) {
    return (
      <OnlyDebug>
        Tool call <DebugValue data={part} />
      </OnlyDebug>
    );
  }

  return (
    <OnlyDebug>
      Unknown Part <DebugValue data={part} />
    </OnlyDebug>
  );
}

export function ChatUIMessage({ uiMessage }: { uiMessage: UIMessage }) {
  const isAssistant = uiMessage.role === "assistant";

  return (
    <Message className={uiMessage.role === "user" ? "justify-end" : "justify-start"}>
      {isAssistant ? <MessageAvatar src="/avatars/ai.png" alt="AI Assistant" fallback="AI" /> : null}
      <DebugValue data={uiMessage} />
      <div className="max-w-[85%] flex-1 sm:max-w-[75%]">
        {isAssistant ? (
          <div className="rounded-lg bg-secondary p-2 text-foreground">
            {uiMessage.parts.map((part, index) => (
              <Fragment key={`${uiMessage.id}:${index}`}>{renderAssistantPart(part)}</Fragment>
            ))}
          </div>
        ) : (
          uiMessage.parts.map((part, index) => (
            <Fragment key={`${uiMessage.id}:${index}`}>{renderUserPart(part)}</Fragment>
          ))
        )}
      </div>
    </Message>
  );
}
