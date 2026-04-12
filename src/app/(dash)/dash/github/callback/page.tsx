"use client";
import { Octokit } from "@octokit/rest";
import { Check } from "lucide-react";
import { useRpcMutation } from "mtmsdk/supabase/use-sb-query/use-rpc-mutation";
import { Card, CardContent } from "mtxuilib/ui/card";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import { toast } from "sonner";
import { CardSkeleton } from "@/components/common/list-skeleton";

function GitHubCallbackContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const installationId = searchParams?.get("installation_id");
  const code = searchParams?.get("code");
  const [statusText, setStatusText] = useState("");
  const [isProcessing, setIsProcessing] = useState(false);

  const isSetupActive = typeof window !== "undefined" && window.localStorage.getItem("gh_app_setup_active") === "true";

  const saveMutation = useRpcMutation("sys_config_set");

  useEffect(() => {
    if (code && isSetupActive && !isProcessing) {
      handleManifestConversion(code);
    }
  }, [code, isSetupActive]);

  async function handleManifestConversion(code: string) {
    if (isProcessing) return;
    setIsProcessing(true);
    try {
      setStatusText("Finishing GitHub App Setup...");
      toast.info("Completing GitHub App setup...");

      // 1. Convert via @octokit/rest
      const octokit = new Octokit();
      const resp = await octokit.rest.apps.createFromManifest({ code });
      const data = resp.data;

      const config = {
        app_id: data.id.toString(),
        slug: data.slug,
        client_id: data.client_id,
        client_secret: data.client_secret,
        private_key: data.pem,
        html_url: data.html_url,
      };

      // 2. Persist to database
      await saveMutation.mutateAsync({
        p_key: "github_app",
        p_value: config,
        p_description: "GitHub Application Configuration for System",
      });

      toast.success("GitHub App successfully created and configured!");

      // Clear flag
      window.localStorage.removeItem("gh_app_setup_active");

      // Redirect back to integrations settings
      router.push("/dash/settings/integrations");
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error(error);
      toast.error("Setup Failed", {
        description: errorMessage,
      });
      setStatusText(`Setup Failed: ${errorMessage}`);
      setIsProcessing(false);
    }
  }

  useEffect(() => {
    if (installationId) {
      // 1. Try window.opener mechanism first
      if (window.opener) {
        try {
          window.opener.postMessage({ type: "github-installation-success", installationId }, window.location.origin);
        } catch (e) {
          console.error("Failed to postMessage to opener:", e);
        }
      }

      // 2. Use localStorage as a reliable fallback (works even if opener is lost)
      const timestamp = Date.now();
      window.localStorage.setItem(
        "github_installation_event",
        JSON.stringify({
          type: "github-installation-success",
          installationId,
          timestamp,
        }),
      );

      // Auto-close the popup after a brief success message
      setTimeout(() => {
        window.close();
      }, 1500);
    }
  }, [installationId]);

  // If it's a Manifest Conversion flow (Admin Setup)
  if (code && isSetupActive) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] p-4">
        <div className="w-full max-w-md">
          <CardSkeleton />
          <div className="text-center mt-6 space-y-2">
            <h2 className="text-xl font-semibold">Configuring System...</h2>
            <p className="text-muted-foreground text-sm">
              {statusText || "Please wait while we finish setting up your GitHub App."}
            </p>
          </div>
        </div>
      </div>
    );
  }

  // If it's a User Installation flow (Connect to Project)
  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] p-4">
      <Card className="w-full max-w-md border-none shadow-lg">
        <CardContent className="pt-10 pb-10 flex flex-col items-center text-center space-y-6">
          <div className="bg-green-100 dark:bg-green-900/30 p-4 rounded-full text-green-600 dark:text-green-400">
            <Check className="w-8 h-8" />
          </div>

          <div className="space-y-2">
            <h2 className="text-2xl font-bold">Successfully Connected!</h2>
            <p className="text-muted-foreground">
              We have verified your installation. <br />
              This window will close automatically.
            </p>
          </div>

          <div className="pt-4 animate-pulse text-sm text-muted-foreground">Redirecting...</div>
        </CardContent>
      </Card>
    </div>
  );
}

export default function GitHubCallbackPage() {
  return (
    <Suspense
      fallback={
        <div className="flex items-center justify-center min-h-screen p-4">
          <div className="w-full max-w-md">
            <CardSkeleton />
          </div>
        </div>
      }
    >
      <GitHubCallbackContent />
    </Suspense>
  );
}
