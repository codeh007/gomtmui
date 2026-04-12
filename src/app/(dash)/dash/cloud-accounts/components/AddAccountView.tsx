"use client";

import { ChevronLeft, ExternalLink } from "lucide-react";
import { Button } from "mtxuilib/ui/button";
import { Label } from "mtxuilib/ui/label";
import { RadioGroup, RadioGroupItem } from "mtxuilib/ui/radio-group";
import { useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { AuthFlowRouter } from "@/components/cloud-account/AuthFlowRouter";
import { getPlatformIcon } from "@/components/cloud-account/platform-icons";
import { PLATFORM_CONFIGS, type PlatformName } from "@/lib/cloud-account/platform-configs";

interface AddAccountViewProps {
  onSuccess?: () => void;
  onCancel?: () => void;
}

export const AddAccountView = ({ onSuccess, onCancel }: AddAccountViewProps) => {
  const searchParams = useSearchParams();
  const [selectedPlatformName, setSelectedPlatformName] = useState<string>("");

  useEffect(() => {
    const state = searchParams?.get("state");
    const code = searchParams?.get("code");
    if (state && code) {
      const stored = sessionStorage.getItem("mtm_oauth_auth_code_pkce");
      if (stored) {
        try {
          const { state: storedState, platform } = JSON.parse(stored);
          if (state === storedState) {
            setSelectedPlatformName(platform);
          }
        } catch (e) {
          console.error("Failed to parse stored PKCE state", e);
        }
      }
    }
  }, [searchParams]);

  const platforms = Object.values(PLATFORM_CONFIGS);
  const selectedPlatform = selectedPlatformName ? PLATFORM_CONFIGS[selectedPlatformName as PlatformName] : null;

  const handlePlatformSelect = (value: string) => {
    setSelectedPlatformName(value);
  };

  return (
    <div className="flex flex-col h-full bg-background rounded-md">
      <div className="grid gap-4 py-4 px-6 min-h-[100px] flex-1 overflow-y-auto">
        {selectedPlatform ? (
          <div className="w-full flex flex-col gap-4 flex-1">
            <div className="flex items-center -ml-2 mb-2">
              <Button variant="ghost" size="sm" onClick={() => setSelectedPlatformName("")} className="gap-2">
                <ChevronLeft className="h-4 w-4" />
                Back to Platform Selection
              </Button>
            </div>
            <AuthFlowRouter platform={selectedPlatform} onSuccess={onSuccess} onCancel={undefined} />
          </div>
        ) : (
          <RadioGroup value={selectedPlatformName} onValueChange={handlePlatformSelect}>
            {platforms.map((platform) => (
              <Label
                key={platform.name}
                htmlFor={platform.name}
                className="flex items-center space-x-3 rounded-lg border p-4 hover:bg-muted/50 transition-colors cursor-pointer"
              >
                <RadioGroupItem value={platform.name} id={platform.name} />
                <div className="flex flex-1 items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="flex items-center justify-center p-2 rounded-md bg-muted border">
                      {(() => {
                        const Icon = getPlatformIcon(platform.name);
                        return <Icon className="h-5 w-5 text-muted-foreground/80" />;
                      })()}
                    </div>
                    <div className="flex flex-col">
                      <span className="font-medium">{platform.displayName}</span>
                      <span className="text-xs text-muted-foreground capitalize">{platform.authFlow}</span>
                    </div>
                  </div>
                </div>
              </Label>
            ))}
          </RadioGroup>
        )}
      </div>

      {!selectedPlatform && (
        <div className="p-6 border-t flex justify-end gap-2 shrink-0 bg-muted/10">
          <Button variant="outline" onClick={onCancel}>
            Cancel
          </Button>
          <Button
            onClick={() => {
              /* Selection is handled by RadioGroup/selectedPlatform logic */
            }}
            disabled={!selectedPlatformName}
          >
            Select Platform
            <ExternalLink className="ml-2 size-4" />
          </Button>
        </div>
      )}
    </div>
  );
};
