"use client";

import { Server } from "lucide-react";
import { useState } from "react";
import { useGomtmServer } from "@/lib/gomtm-server/provider";
import { getGomtmServerHost, isValidGomtmServerUrl, normalizeGomtmServerUrl } from "@/lib/gomtm-server/url";
import { Button } from "mtxuilib/ui/button";
import { Input } from "mtxuilib/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "mtxuilib/ui/popover";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "mtxuilib/ui/tooltip";

const INVALID_URL_MESSAGE = "请输入 http(s) 地址";

export function GomtmServerSwitcher() {
  const { saveServerUrl, serverUrl, serverUrlInput, setServerUrlInput } = useGomtmServer();
  const [errorMessage, setErrorMessage] = useState("");
  const [open, setOpen] = useState(false);

  const handleSave = () => {
    const nextServerUrl = normalizeGomtmServerUrl(serverUrlInput);
    if (!isValidGomtmServerUrl(nextServerUrl)) {
      setErrorMessage(INVALID_URL_MESSAGE);
      return;
    }

    if (!saveServerUrl()) {
      setErrorMessage(INVALID_URL_MESSAGE);
      return;
    }

    setErrorMessage("");
    setOpen(false);
  };

  return (
    <TooltipProvider>
      <Popover
        open={open}
        onOpenChange={(nextOpen) => {
          setOpen(nextOpen);
          if (!nextOpen) {
            setErrorMessage("");
          }
        }}
      >
        <Tooltip>
          <TooltipTrigger asChild>
            <PopoverTrigger asChild>
              <Button
                aria-label="切换 gomtm server"
                className="h-8 w-8"
                size="icon"
                type="button"
                variant="ghost"
              >
                <Server className="size-4" />
              </Button>
            </PopoverTrigger>
          </TooltipTrigger>
          <TooltipContent side="bottom" className="text-xs">
            {getGomtmServerHost(serverUrl)}
          </TooltipContent>
        </Tooltip>
        <PopoverContent align="end" className="w-72 p-3">
          <form
            className="flex items-start gap-2"
            onSubmit={(event) => {
              event.preventDefault();
              handleSave();
            }}
          >
            <div className="flex-1">
              <Input
                value={serverUrlInput}
                onChange={(event) => {
                  setServerUrlInput(event.target.value);
                  if (errorMessage) {
                    setErrorMessage("");
                  }
                }}
              />
              {errorMessage ? <div className="mt-2 text-xs text-destructive">{errorMessage}</div> : null}
            </div>
            <Button type="submit" size="sm">
              保存
            </Button>
          </form>
        </PopoverContent>
      </Popover>
    </TooltipProvider>
  );
}
