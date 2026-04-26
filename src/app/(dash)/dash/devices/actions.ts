"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export interface BindAndroidHostDeviceInput {
  name: string;
  platform: string;
  metadata: Record<string, unknown>;
  tags?: string[];
}

export async function bindAndroidHostDeviceAction(input: BindAndroidHostDeviceInput) {
  const supabase = await createClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError) {
    throw authError;
  }

  if (!user) {
    throw new Error("未登录，无法绑定当前设备");
  }

  const { data, error } = await supabase.rpc("device_bind_current_session", {
    p_name: input.name,
    p_platform: input.platform,
    p_metadata: input.metadata,
    p_tags: input.tags ?? [],
  });

  if (error) {
    throw error;
  }

  revalidatePath("/dash/devices");
  return data;
}
