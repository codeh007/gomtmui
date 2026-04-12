import type { ServerInstanceGetReturns, TrafficLog, TrafficLogRow } from "mtmsdk/types/contracts";
import type { ServerInstanceStatusDto } from "@/components/server-instance/status-contract";

export type SidecarDatabase = {
  public: {
    Tables: {
      traffic_logs: {
        Row: TrafficLogRow;
        Insert: Partial<TrafficLogRow>;
        Update: Partial<TrafficLogRow>;
      };
    };
  };
};

export interface InstanceConfig {
  sidecar_db_url?: string;
  sidecar_db_key?: string;
  public_url?: string;
  [key: string]: unknown;
}

export function mapRowToTrafficLog(row: TrafficLogRow): TrafficLog {
  return {
    id: row.id || Math.random().toString(),
    method: row.method || "UNKNOWN",
    scheme: row.scheme || "http",
    host: row.host || "",
    path: row.path || "",
    status: row.status_code || 0,
    size: row.response_body ? `${(row.response_body.length / 1024).toFixed(1)} KB` : "0 KB",
    duration: row.duration_ms ? `${row.duration_ms}ms` : "0ms",
    timestamp: row.created_at,
    tags: [],
    request_headers: row.request_headers || undefined,
    response_headers: row.response_headers || undefined,
    request_body: row.request_body || undefined,
    response_body: row.response_body || undefined,
    client_ip: row.client_ip || undefined,
  };
}

export function getServerStateStatus(
  resource: Pick<ServerInstanceGetReturns, "state"> | ServerInstanceStatusDto | null,
) {
  if (resource && "status" in resource) {
    return typeof resource.status === "string" ? resource.status : null;
  }

  if (!resource || !("state" in resource)) {
    return null;
  }

  const state = (resource.state as InstanceConfig | null) ?? null;
  return typeof state?.status === "string" ? state.status : null;
}

export function getServerPublicUrl(resource: ServerInstanceGetReturns | null) {
  const state = (resource?.state as InstanceConfig | null) ?? null;
  return state?.public_url || "";
}

export function formatServerOptionLabel(instance: ServerInstanceStatusDto) {
  const status = getServerStateStatus(instance);
  const name = instance.id?.slice(0, 8) || "unknown";
  return status ? `${name} (${status})` : name;
}
