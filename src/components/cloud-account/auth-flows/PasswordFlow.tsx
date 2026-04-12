"use client";

import { Button } from "mtxuilib/ui/button";
import React from "react";
import type { FlowProps } from "./DeviceFlow";

export const PasswordFlow: React.FC<Pick<FlowProps, "platform">> = ({ platform }) => {
  return (
    <div className="flex flex-col items-center justify-center p-6 space-y-4">
      <p className="text-sm text-center text-muted-foreground">
        Password authentication for {platform.displayName} is coming soon.
      </p>
      <div className="w-full max-w-xs space-y-2">
        <Button disabled className="w-full">
          Login with Password
        </Button>
      </div>
    </div>
  );
};
