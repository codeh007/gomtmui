"use client";

import type { UIMessage } from "ai";
import { ArrowUp, Globe, Mic, MoreHorizontal, Plus } from "lucide-react";
import { randomUUID } from "mtxuilib/lib/utils";
import {
  PromptInput,
  PromptInputAction,
  PromptInputActions,
  PromptInputTextarea,
} from "mtxuilib/prompt-kit/prompt-input";
import { Button } from "mtxuilib/ui/button";
import { useState } from "react";

export interface Chatv2PromptInputProps {
  isLoading?: boolean;
  onSubmit: (userInputMessage: UIMessage) => void;
}
export function Chatv2PromptInput({ onSubmit }: Chatv2PromptInputProps) {
  const [prompt, setPrompt] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const handleSubmit = async () => {
    if (!prompt.trim()) return;
    setPrompt("");
    setIsLoading(true);
    // chatAgent.sendMessage({ text: prompt });
    onSubmit({
      role: "user",
      id: randomUUID(),
      parts: [{ type: "text", text: prompt }],
    }); //暂时仅限文本聊天消息.
    setIsLoading(false);
  };
  return (
    <PromptInput
      isLoading={isLoading}
      value={prompt}
      onValueChange={setPrompt}
      onSubmit={handleSubmit}
      className="border-input bg-popover relative z-10 w-full rounded-xl border p-0 pt-1 shadow-xs"
    >
      <div className="flex flex-col">
        <PromptInputTextarea
          placeholder="Ask anything"
          className="min-h-11 pt-3 pl-4 text-base leading-[1.3] sm:text-base md:text-base"
        />
        <PromptInputActions className="mt-5 flex w-full items-center justify-between gap-2 px-3 pb-1">
          <div className="flex items-center gap-2">
            <PromptInputAction tooltip="Add a new action">
              <Button variant="outline" size="icon" className="size-9 rounded-full">
                <Plus size={18} />
              </Button>
            </PromptInputAction>

            <PromptInputAction tooltip="Search">
              <Button variant="outline" className="rounded-full">
                <Globe size={18} />
                Search
              </Button>
            </PromptInputAction>

            <PromptInputAction tooltip="More actions">
              <Button variant="outline" size="icon" className="size-9 rounded-full">
                <MoreHorizontal size={18} />
              </Button>
            </PromptInputAction>
          </div>
          <div className="flex items-center gap-2">
            <PromptInputAction tooltip="Voice input">
              <Button variant="outline" size="icon" className="size-9 rounded-full">
                <Mic size={18} />
              </Button>
            </PromptInputAction>
            <Button
              size="icon"
              disabled={!prompt.trim() || isLoading}
              onClick={handleSubmit}
              className="size-9 rounded-full"
            >
              {!isLoading ? <ArrowUp size={18} /> : <span className="size-3 rounded-xs bg-white" />}
            </Button>
          </div>
        </PromptInputActions>
      </div>
    </PromptInput>
  );
}
