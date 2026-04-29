import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export async function requireAdminSettingsAccess() {
  const supabase = await createClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    redirect("/auth/login");
  }

  const { data: isAdmin, error: permissionError } = await supabase.rpc("has_permission", {
    p_resource: "sys_config",
    p_action: "write",
  });

  if (permissionError) {
    throw permissionError;
  }

  if (isAdmin !== true) {
    redirect("/dash");
  }

  return supabase;
}
