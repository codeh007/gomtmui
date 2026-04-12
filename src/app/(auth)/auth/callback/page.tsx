"use client";

import { useSupabaseBrowser } from "mtmsdk/supabase/context";
import { Button } from "mtxuilib/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "mtxuilib/ui/card";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { CardSkeleton } from "@/components/common/list-skeleton";

export default function AuthCallbackPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const supabase = useSupabaseBrowser();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const handleCallback = async () => {
      const code = searchParams?.get("code");
      const next = searchParams?.get("next") ?? "/dash";
      const errorDescription = searchParams?.get("error_description");
      const errorMsg = searchParams?.get("error");

      if (errorMsg || errorDescription) {
        setError(errorDescription ?? errorMsg ?? null);
        return;
      }

      if (code) {
        try {
          const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);
          if (exchangeError) {
            // In React Strict Mode (dev), this effect might run twice.
            // If the first run succeeded, the code is consumed and the second run fails with "invalid request".
            // We check if we have a valid session to distinguish this case.
            const { data } = await supabase.auth.getSession();
            if (data?.session) {
              router.push(next);
              router.refresh();
              return;
            }
            setError(exchangeError.message);
          } else {
            router.push(next);
            router.refresh(); // Ensure the server component re-renders with the new cookie
          }
        } catch (err: unknown) {
          setError(err instanceof Error ? err.message : "An unexpected error occurred");
        }
      } else {
        // If no code, check if we have a session (maybe implicit flow or just reused tab)
        const { data } = await supabase.auth.getSession();
        if (data.session) {
          router.push(next);
        } else {
          router.push("/auth/login");
        }
      }
    };

    handleCallback();
  }, [searchParams, router, supabase]);

  if (error) {
    return (
      <div className="flex min-h-screen items-center justify-center p-4">
        <Card className="w-full max-w-md border-red-200 bg-red-50/50">
          <CardHeader>
            <CardTitle className="text-red-600">Authentication Error</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <p className="text-sm text-red-600">{error}</p>
            <Button
              variant="outline"
              onClick={() => router.push("/auth/login")}
              className="w-full border-red-200 hover:bg-red-100 hover:text-red-700"
            >
              Back to Login
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-4">
      <div className="w-full max-w-md">
        <CardSkeleton />
        <p className="text-center text-sm text-muted-foreground mt-4">Verifying authentication...</p>
      </div>
    </div>
  );
}
