import type {
  AnalyticsResponse,
  CronJob,
  EnvVarInfo,
  LogsResponse,
  ModelInfoResponse,
  SessionInfo,
  SessionMessage,
  SessionSearchResponse,
  SkillInfo,
  StatusResponse,
  ToolsetInfo,
} from "./types";

function getGomtmServerUrl() {
  const configuredUrl = process.env.NEXT_PUBLIC_GOMTM_SERVER_URL?.trim();
  if (!configuredUrl) {
    throw new Error("missing NEXT_PUBLIC_GOMTM_SERVER_URL for Hermes API requests");
  }
  return configuredUrl.replace(/\/$/, "");
}

async function fetchJSON<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${getGomtmServerUrl()}/api/hermes${path}`, {
    cache: "no-store",
    ...init,
  });

  if (!response.ok) {
    const text = await response.text().catch(() => response.statusText);
    throw new Error(`${response.status}: ${text}`);
  }

  return response.json() as Promise<T>;
}

export const hermesApi = {
  getStatus: () => fetchJSON<StatusResponse>("/status"),
  getSessions: (limit = 20, offset = 0) => fetchJSON<{ sessions: SessionInfo[] }>(`/sessions?limit=${limit}&offset=${offset}`),
  getSessionMessages: (id: string) => fetchJSON<{ messages: SessionMessage[] }>(`/sessions/${encodeURIComponent(id)}/messages`),
  searchSessions: (q: string) => fetchJSON<SessionSearchResponse>(`/sessions/search?q=${encodeURIComponent(q)}`),
  getLogs: (params: { file?: string; lines?: number; level?: string; component?: string }) => {
    const qs = new URLSearchParams();

    if (params.file) qs.set("file", params.file);
    if (params.lines) qs.set("lines", String(params.lines));
    if (params.level && params.level !== "ALL") qs.set("level", params.level);
    if (params.component && params.component !== "all") qs.set("component", params.component);

    const query = qs.toString();
    return fetchJSON<LogsResponse>(`/logs${query ? `?${query}` : ""}`);
  },
  getAnalytics: (days: number) => fetchJSON<AnalyticsResponse>(`/analytics/usage?days=${days}`),
  getCronJobs: () => fetchJSON<CronJob[]>("/cron/jobs"),
  getSkills: () => fetchJSON<SkillInfo[]>("/skills"),
  getToolsets: () => fetchJSON<ToolsetInfo[]>("/tools/toolsets"),
  getConfig: () => fetchJSON<Record<string, unknown>>("/config"),
  getDefaults: () => fetchJSON<Record<string, unknown>>("/config/defaults"),
  getSchema: () => fetchJSON<{ fields: Record<string, unknown>; category_order: string[] }>("/config/schema"),
  getModelInfo: () => fetchJSON<ModelInfoResponse>("/model/info"),
  getEnvVars: () => fetchJSON<Record<string, EnvVarInfo>>("/env"),
};
