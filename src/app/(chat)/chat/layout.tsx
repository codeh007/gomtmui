import { useSupabaseServer } from "mtmsdk/supabase/supabase-client";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
export const dynamic = "force-dynamic";
export default async function DashLayout({ children }: { children: React.ReactNode }) {
  const cookieStore = await cookies();
  const supabase = useSupabaseServer(cookieStore);

  const { data, error } = await supabase.auth.getClaims();
  if (error || !data?.claims) {
    redirect("/auth/login");
  }
  return <>{children}</>;
}
