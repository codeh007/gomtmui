import { SupabaseAuthProvider } from "mtmsdk/supabase/auth-provider";
import { useSupabaseServer } from "mtmsdk/supabase/supabase-client";
import { SidebarInset } from "mtxuilib/ui/sidebar";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { CommandMenu } from "@/components/command-menu";
import { DashRoot } from "@/components/dash-layout";
import { RealtimeProvider } from "@/stores/realtime-provider";
import { SidebarDash } from "./SidebarDash";

export default async function Layout({ children }: { children: React.ReactNode }) {
  const cookieStore = await cookies();
  const supabase = useSupabaseServer(cookieStore);

  const { data, error } = await supabase.auth.getClaims();
  if (error || !data?.claims) {
    redirect("/auth/login");
  }

  const cookie = cookieStore.get("sidebar_state");
  const defaultOpen = cookie ? cookie.value === "true" : undefined;
  return (
    <DashRoot className="h-svh overflow-hidden" defaultOpen={defaultOpen}>
      <CommandMenu />
      <SidebarDash pathname={"/dash"} />
      <SidebarInset className="h-full overflow-hidden flex flex-col">
        <SupabaseAuthProvider>
          <RealtimeProvider>{children}</RealtimeProvider>
        </SupabaseAuthProvider>
      </SidebarInset>
    </DashRoot>
  );
}
