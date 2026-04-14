import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "mtmsdk/supabase/supabase";

export const dynamic = "force-dynamic";

function asRecord(value: unknown) {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  return {};
}

function readString(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

async function resolveReadyServerStatusUrl() {
  const sbAdmin = getSupabaseAdmin();
  const { data, error } = await sbAdmin.rpc("server_list_cursor", { p_limit: 20 });
  if (error) {
    throw new Error(`load server_list_cursor failed: ${error.message}`);
  }
  const rows = Array.isArray(data) ? data : [];
  for (const row of rows) {
    const record = asRecord(row);
    const state = asRecord(record.state);
    const config = asRecord(record.config);
    const tunnel = asRecord(config.tunnel);
    if (readString(state.status) !== "ready") {
      continue;
    }
    const hostname = readString(tunnel.hostname);
    if (hostname === "") {
      continue;
    }
    return new URL("/api/system/status", `https://${hostname}`).toString();
  }
  return null;
}

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
