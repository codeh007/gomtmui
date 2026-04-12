"use client";

import { Check } from "lucide-react";
import { Card, CardContent } from "mtxuilib/ui/card";
import { useSearchParams } from "next/navigation";
import { Suspense, useEffect } from "react";
import { CardSkeleton } from "@/components/common/list-skeleton";

function SupabaseCallbackContent() {
  const searchParams = useSearchParams();
  const code = searchParams?.get("code");

  useEffect(() => {
    if (code) {
      // 1. Try window.opener mechanism first
      if (window.opener) {
        try {
          window.opener.postMessage({ type: "SUPABASE_AUTH_CODE", code }, window.location.origin);
        } catch (e) {
          console.error("Failed to postMessage to opener:", e);
        }
      }

      // 2. Use localStorage as a reliable fallback
      window.localStorage.setItem("supabase_auth_code", code);

      // Auto-close the popup after a brief success message
      setTimeout(() => {
        window.close();
      }, 1500);
    }
  }, [code]);

  if (!code) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <p className="text-muted-foreground">Invalid callback URL.</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center justify-center min-h-screen p-4">
      <Card className="w-full max-w-md border-none shadow-lg">
        <CardContent className="pt-10 pb-10 flex flex-col items-center text-center space-y-6">
          <div className="bg-green-100 dark:bg-green-900/30 p-4 rounded-full text-green-600 dark:text-green-400">
            <Check className="w-8 h-8" />
          </div>

          <div className="space-y-2">
            <h2 className="text-2xl font-bold">Successfully Connected!</h2>
            <p className="text-muted-foreground">
              We have verified your Supabase connection. <br />
              This window will close automatically.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

export default function SupabaseCallbackPage() {
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
      <SupabaseCallbackContent />
    </Suspense>
  );
}
