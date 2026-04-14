import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "mtmsdk/supabase/supabase";
import { getServerAccessUrl, serverInstanceListSchema } from "@/components/server-instance/status-contract";

export const dynamic = "force-dynamic";

function getReadyServerStatusUrl() {
  return async () => {
    const sbAdmin = getSupabaseAdmin();
    const { data, error } = await sbAdmin.rpc("server_list_cursor", { p_limit: 20 });
    if (error) {
      throw new Error(`load server_list_cursor failed: ${error.message}`);
    }
    const instances = serverInstanceListSchema.parse(data ?? []);
    for (const instance of instances) {
      const accessUrl = getServerAccessUrl(instance.status, instance.hostname);
      if (accessUrl) {
        return new URL("/api/system/status", accessUrl).toString();
      }
    }
    return null;
  };
}

const resolveReadyServerStatusUrl = getReadyServerStatusUrl();

export async function GET() {
  try {
    const statusUrl = await resolveReadyServerStatusUrl();
    if (!statusUrl) {
      return NextResponse.json({}, { status: 503, headers: { "cache-control": "no-store" } });
    }

    const response = await fetch(statusUrl, { cache: "no-store" });
    if (!response.ok) {
      return NextResponse.json({}, { status: response.status, headers: { "cache-control": "no-store" } });
    }

    const payload = await response.json();
    return NextResponse.json(payload, { status: response.status, headers: { "cache-control": "no-store" } });
  } catch (error) {
    const message = error instanceof Error ? error.message : "system status unavailable";
    return NextResponse.json({ error: message }, { status: 502, headers: { "cache-control": "no-store" } });
  }
}
