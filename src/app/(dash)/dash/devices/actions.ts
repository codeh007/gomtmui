"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export interface BindAndroidHostDeviceInput {
  name: string;
  platform: string;
  metadata: Record<string, unknown>;
  tags?: string[];
}

export interface ActivateAndroidHostDeviceInput {
  deviceId: string;
}

export interface StopAndroidHostDeviceInput {
	deviceId: string;
	lastError?: string | null;
}

export interface ArchiveDeviceInput {
	deviceId: string;
}

async function requireCurrentUser() {
  const supabase = await createClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError) {
    throw authError;
  }

  if (!user) {
    throw new Error("未登录，无法执行当前设备动作");
  }

  return { supabase, user };
}

export async function bindAndroidHostDeviceAction(input: BindAndroidHostDeviceInput) {
  const { supabase } = await requireCurrentUser();

  const { data, error } = await supabase.rpc("device_bind_current_session", {
    p_name: input.name,
    p_platform: input.platform,
    p_metadata: input.metadata,
    p_tags: input.tags ?? [],
  });

  if (error) {
    throw error;
  }

  const device = Array.isArray(data) ? data[0] : data;
  const deviceId = typeof device?.id === "string" ? device.id : null;
  if (!deviceId) {
    throw new Error("绑定当前设备成功，但未返回有效 device_id");
  }

  const { data: runtimeCredential, error: runtimeCredentialError } = await supabase.rpc("device_issue_runtime_credential", {
    p_device_id: deviceId,
  });

  if (runtimeCredentialError) {
    throw runtimeCredentialError;
  }

  revalidatePath("/dash/devices");
  return {
    device,
    runtimeCredential,
  };
}

export async function activateAndroidHostDeviceAction(input: ActivateAndroidHostDeviceInput) {
  const { supabase } = await requireCurrentUser();

	const { data, error } = await supabase.rpc("device_mark_runtime_started", {
		p_device_id: input.deviceId,
		p_last_error: null,
	});

  if (error) {
    throw error;
  }

	revalidatePath("/dash/devices");
	return data;
}

export async function archiveDeviceAction(input: ArchiveDeviceInput) {
	const { supabase } = await requireCurrentUser();

	const { data, error } = await supabase.rpc("device_archive", {
		p_device_id: input.deviceId,
	});

	if (error) {
		throw error;
	}

	revalidatePath("/dash/devices");
	return data;
}

export async function stopAndroidHostDeviceAction(input: StopAndroidHostDeviceInput) {
  const { supabase } = await requireCurrentUser();

  const { data, error } = await supabase.rpc("device_mark_runtime_stopped", {
    p_device_id: input.deviceId,
    p_last_error: input.lastError ?? null,
  });

  if (error) {
    throw error;
  }

  revalidatePath("/dash/devices");
  return data;
}
