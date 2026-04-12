"use client";

import { useSupabaseBrowser } from "mtmsdk/supabase/context";
import { Button } from "mtxuilib/ui/button";
import { useRouter } from "next/navigation";

export function LogoutButton() {
  const router = useRouter();
  const supabase = useSupabaseBrowser();
  const logout = async () => {
    await supabase.auth.signOut();
    router.push("/auth/login");
  };

  return <Button onClick={logout}>Logout</Button>;
}
