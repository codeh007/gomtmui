"use client";
import { SupabaseClientProvider } from "mtmsdk/supabase/context";
import { MtxuiProvider } from "mtxuilib/store/MtxuiProvider";
import GomtmProvider from "./GomtmProvider";

export const MainProvider = ({ children }: React.PropsWithChildren) => {
  return (
    <MtxuiProvider>
      <SupabaseClientProvider
        url={process.env.NEXT_PUBLIC_SUPABASE_URL}
        publicKey={process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY}
      >
        <GomtmProvider>{children}</GomtmProvider>
      </SupabaseClientProvider>
    </MtxuiProvider>
  );
};
