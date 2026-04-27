import type { DashboardTheme } from "@/themes/types";
import { isValidGomtmServerUrl, normalizeGomtmServerUrl } from "@/lib/gomtm-server/url";

const HERMES_API_PREFIX = "/api/hermes";

// Ephemeral session token for protected endpoints.
// Injected into index.html by the server — never fetched via API.
declare global {
  interface Window {
    __HERMES_SESSION_TOKEN__?: string;
  }
}
let _sessionToken: string | null = null;
const SESSION_HEADER = "X-Hermes-Session-Token";

function setSessionHeader(headers: Headers, token: string): void {
  if (!headers.has(SESSION_HEADER)) {
    headers.set(SESSION_HEADER, token);
  }
}

export async function fetchJSON<T>(url: string, init?: RequestInit): Promise<T> {
  // Inject the session token into Hermes requests served by the selected gomtm server.
  const headers = new Headers(init?.headers);
  const token = window.__HERMES_SESSION_TOKEN__;
  if (token) {
    setSessionHeader(headers, token);
  }
  const res = await fetch(url, { ...init, headers });
  if (!res.ok) {
    const text = await res.text().catch(() => res.statusText);
    throw new Error(`${res.status}: ${text}`);
  }
  return res.json();
}

function requireGomtmServerUrl(baseUrl: string): string {
  const normalizedBaseUrl = normalizeGomtmServerUrl(baseUrl);
  if (!isValidGomtmServerUrl(normalizedBaseUrl)) {
    throw new Error("Hermes API requires a valid gomtm server URL.");
  }
  return normalizedBaseUrl;
}

function buildHermesUrl(baseUrl: string, path: string): string {
  const normalizedBaseUrl = requireGomtmServerUrl(baseUrl);
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  return `${normalizedBaseUrl}${HERMES_API_PREFIX}${normalizedPath}`;
}

function fetchHermesJSON<T>(baseUrl: string, path: string, init?: RequestInit): Promise<T> {
  return fetchJSON<T>(buildHermesUrl(baseUrl, path), init);
}

async function getSessionToken(): Promise<string> {
  if (_sessionToken) return _sessionToken;
  const injected = window.__HERMES_SESSION_TOKEN__;
  if (injected) {
    _sessionToken = injected;
    return _sessionToken;
  }
  throw new Error("Session token not available — page must be served by the Hermes dashboard server");
}

export function fetchHermesSessionDetail(baseUrl: string, id: string): Promise<SessionInfo> {
  return fetchHermesJSON<SessionInfo>(baseUrl, `/sessions/${encodeURIComponent(id)}`);
}

export function createHermesApi(baseUrl: string) {
  const validatedBaseUrl = requireGomtmServerUrl(baseUrl);

  return {
    baseUrl: validatedBaseUrl,
    getStatus: () => fetchHermesJSON<StatusResponse>(validatedBaseUrl, "/status"),
    getSessions: (limit = 20, offset = 0) =>
      fetchHermesJSON<PaginatedSessions>(validatedBaseUrl, `/sessions?limit=${limit}&offset=${offset}`),
    getSessionDetail: (id: string) => fetchHermesSessionDetail(validatedBaseUrl, id),
    getSessionMessages: (id: string) =>
      fetchHermesJSON<SessionMessagesResponse>(validatedBaseUrl, `/sessions/${encodeURIComponent(id)}/messages`),
    deleteSession: (id: string) =>
      fetchHermesJSON<{ ok: boolean }>(validatedBaseUrl, `/sessions/${encodeURIComponent(id)}`, {
        method: "DELETE",
      }),
    getLogs: (params: { file?: string; lines?: number; level?: string; component?: string }) => {
      const qs = new URLSearchParams();
      if (params.file) qs.set("file", params.file);
      if (params.lines) qs.set("lines", String(params.lines));
      if (params.level && params.level !== "ALL") qs.set("level", params.level);
      if (params.component && params.component !== "all") qs.set("component", params.component);
      return fetchHermesJSON<LogsResponse>(validatedBaseUrl, `/logs?${qs.toString()}`);
    },
    getAnalytics: (days: number) =>
      fetchHermesJSON<AnalyticsResponse>(validatedBaseUrl, `/analytics/usage?days=${days}`),
    getConfig: () => fetchHermesJSON<Record<string, unknown>>(validatedBaseUrl, "/config"),
    getDefaults: () => fetchHermesJSON<Record<string, unknown>>(validatedBaseUrl, "/config/defaults"),
    getSchema: () =>
      fetchHermesJSON<{ fields: Record<string, unknown>; category_order: string[] }>(validatedBaseUrl, "/config/schema"),
    getModelInfo: () => fetchHermesJSON<ModelInfoResponse>(validatedBaseUrl, "/model/info"),
    saveConfig: (config: Record<string, unknown>) =>
      fetchHermesJSON<{ ok: boolean }>(validatedBaseUrl, "/config", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ config }),
      }),
    getConfigRaw: () => fetchHermesJSON<{ yaml: string }>(validatedBaseUrl, "/config/raw"),
    saveConfigRaw: (yaml_text: string) =>
      fetchHermesJSON<{ ok: boolean }>(validatedBaseUrl, "/config/raw", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ yaml_text }),
      }),
    getEnvVars: () => fetchHermesJSON<Record<string, EnvVarInfo>>(validatedBaseUrl, "/env"),
    setEnvVar: (key: string, value: string) =>
      fetchHermesJSON<{ ok: boolean }>(validatedBaseUrl, "/env", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ key, value }),
      }),
    deleteEnvVar: (key: string) =>
      fetchHermesJSON<{ ok: boolean }>(validatedBaseUrl, "/env", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ key }),
      }),
    revealEnvVar: async (key: string) => {
      const token = await getSessionToken();
      return fetchHermesJSON<{ key: string; value: string }>(validatedBaseUrl, "/env/reveal", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          [SESSION_HEADER]: token,
        },
        body: JSON.stringify({ key }),
      });
    },

    // Cron jobs
    getCronJobs: () => fetchHermesJSON<CronJob[]>(validatedBaseUrl, "/cron/jobs"),
    createCronJob: (job: { prompt: string; schedule: string; name?: string; deliver?: string }) =>
      fetchHermesJSON<CronJob>(validatedBaseUrl, "/cron/jobs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(job),
      }),
    pauseCronJob: (id: string) =>
      fetchHermesJSON<{ ok: boolean }>(validatedBaseUrl, `/cron/jobs/${id}/pause`, { method: "POST" }),
    resumeCronJob: (id: string) =>
      fetchHermesJSON<{ ok: boolean }>(validatedBaseUrl, `/cron/jobs/${id}/resume`, { method: "POST" }),
    triggerCronJob: (id: string) =>
      fetchHermesJSON<{ ok: boolean }>(validatedBaseUrl, `/cron/jobs/${id}/trigger`, { method: "POST" }),
    deleteCronJob: (id: string) =>
      fetchHermesJSON<{ ok: boolean }>(validatedBaseUrl, `/cron/jobs/${id}`, { method: "DELETE" }),

    // Skills & Toolsets
    getSkills: () => fetchHermesJSON<SkillInfo[]>(validatedBaseUrl, "/skills"),
    toggleSkill: (name: string, enabled: boolean) =>
      fetchHermesJSON<{ ok: boolean }>(validatedBaseUrl, "/skills/toggle", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, enabled }),
      }),
    getToolsets: () => fetchHermesJSON<ToolsetInfo[]>(validatedBaseUrl, "/tools/toolsets"),

    // Session search (FTS5)
    searchSessions: (q: string) =>
      fetchHermesJSON<SessionSearchResponse>(validatedBaseUrl, `/sessions/search?q=${encodeURIComponent(q)}`),

    // OAuth provider management
    getOAuthProviders: () => fetchHermesJSON<OAuthProvidersResponse>(validatedBaseUrl, "/providers/oauth"),
    disconnectOAuthProvider: async (providerId: string) => {
      const token = await getSessionToken();
      return fetchHermesJSON<{ ok: boolean; provider: string }>(validatedBaseUrl, `/providers/oauth/${encodeURIComponent(providerId)}`, {
        method: "DELETE",
        headers: { [SESSION_HEADER]: token },
      });
    },
    startOAuthLogin: async (providerId: string) => {
      const token = await getSessionToken();
      return fetchHermesJSON<OAuthStartResponse>(validatedBaseUrl, `/providers/oauth/${encodeURIComponent(providerId)}/start`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          [SESSION_HEADER]: token,
        },
        body: "{}",
      });
    },
    submitOAuthCode: async (providerId: string, sessionId: string, code: string) => {
      const token = await getSessionToken();
      return fetchHermesJSON<OAuthSubmitResponse>(validatedBaseUrl, `/providers/oauth/${encodeURIComponent(providerId)}/submit`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          [SESSION_HEADER]: token,
        },
        body: JSON.stringify({ session_id: sessionId, code }),
      });
    },
    pollOAuthSession: (providerId: string, sessionId: string) =>
      fetchHermesJSON<OAuthPollResponse>(
        validatedBaseUrl,
        `/providers/oauth/${encodeURIComponent(providerId)}/poll/${encodeURIComponent(sessionId)}`,
      ),
    cancelOAuthSession: async (sessionId: string) => {
      const token = await getSessionToken();
      return fetchHermesJSON<{ ok: boolean }>(validatedBaseUrl, `/providers/oauth/sessions/${encodeURIComponent(sessionId)}`, {
        method: "DELETE",
        headers: { [SESSION_HEADER]: token },
      });
    },

    // Gateway / update actions
    restartGateway: () => fetchHermesJSON<ActionResponse>(validatedBaseUrl, "/gateway/restart", { method: "POST" }),
    updateHermes: () => fetchHermesJSON<ActionResponse>(validatedBaseUrl, "/update", { method: "POST" }),
    getActionStatus: (name: string, lines = 200) =>
      fetchHermesJSON<ActionStatusResponse>(validatedBaseUrl, `/actions/${encodeURIComponent(name)}/status?lines=${lines}`),

    // Dashboard plugins
    getPlugins: () => fetchHermesJSON<PluginManifestResponse[]>(validatedBaseUrl, "/dashboard/plugins"),
    rescanPlugins: () =>
      fetchHermesJSON<{ ok: boolean; count: number }>(validatedBaseUrl, "/dashboard/plugins/rescan"),

    // Dashboard themes
    getThemes: () => fetchHermesJSON<DashboardThemesResponse>(validatedBaseUrl, "/dashboard/themes"),
    setTheme: (name: string) =>
      fetchHermesJSON<{ ok: boolean; theme: string }>(validatedBaseUrl, "/dashboard/theme", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name }),
      }),
  };
}

export interface ActionResponse {
  name: string;
  ok: boolean;
  pid: number;
}

export interface ActionStatusResponse {
  exit_code: number | null;
  lines: string[];
  name: string;
  pid: number | null;
  running: boolean;
}

export interface PlatformStatus {
  error_code?: string;
  error_message?: string;
  state: string;
  updated_at: string;
}

export interface StatusResponse {
  active_sessions: number;
  config_path: string;
  config_version: number;
  env_path: string;
  gateway_exit_reason: string | null;
  gateway_health_url: string | null;
  gateway_pid: number | null;
  gateway_platforms: Record<string, PlatformStatus>;
  gateway_running: boolean;
  gateway_state: string | null;
  gateway_updated_at: string | null;
  hermes_home: string;
  latest_config_version: number;
  release_date: string;
  version: string;
}

export interface SessionInfo {
  id: string;
  source: string | null;
  model: string | null;
  title: string | null;
  started_at: number;
  ended_at: number | null;
  last_active: number;
  is_active: boolean;
  message_count: number;
  tool_call_count: number;
  input_tokens: number;
  output_tokens: number;
  preview: string | null;
}

export interface PaginatedSessions {
  sessions: SessionInfo[];
  total: number;
  limit: number;
  offset: number;
}

export interface EnvVarInfo {
  is_set: boolean;
  redacted_value: string | null;
  description: string;
  url: string | null;
  category: string;
  is_password: boolean;
  tools: string[];
  advanced: boolean;
}

export interface SessionMessage {
  role: "user" | "assistant" | "system" | "tool";
  content: string | null;
  tool_calls?: Array<{
    id: string;
    function: { name: string; arguments: string };
  }>;
  tool_name?: string;
  tool_call_id?: string;
  timestamp?: number;
}

export interface SessionMessagesResponse {
  session_id: string;
  messages: SessionMessage[];
}

export interface LogsResponse {
  file: string;
  lines: string[];
}

export interface AnalyticsDailyEntry {
  day: string;
  input_tokens: number;
  output_tokens: number;
  cache_read_tokens: number;
  reasoning_tokens: number;
  estimated_cost: number;
  actual_cost: number;
  sessions: number;
  api_calls: number;
}

export interface AnalyticsModelEntry {
  model: string;
  input_tokens: number;
  output_tokens: number;
  estimated_cost: number;
  sessions: number;
  api_calls: number;
}

export interface AnalyticsSkillEntry {
  skill: string;
  view_count: number;
  manage_count: number;
  total_count: number;
  percentage: number;
  last_used_at: number | null;
}

export interface AnalyticsSkillsSummary {
  total_skill_loads: number;
  total_skill_edits: number;
  total_skill_actions: number;
  distinct_skills_used: number;
}

export interface AnalyticsResponse {
  daily: AnalyticsDailyEntry[];
  by_model: AnalyticsModelEntry[];
  totals: {
    total_input: number;
    total_output: number;
    total_cache_read: number;
    total_reasoning: number;
    total_estimated_cost: number;
    total_actual_cost: number;
    total_sessions: number;
    total_api_calls: number;
  };
  skills: {
    summary: AnalyticsSkillsSummary;
    top_skills: AnalyticsSkillEntry[];
  };
}

export interface CronJob {
  id: string;
  name?: string;
  prompt: string;
  schedule: { kind: string; expr: string; display: string };
  schedule_display: string;
  enabled: boolean;
  state: string;
  deliver?: string;
  last_run_at?: string | null;
  next_run_at?: string | null;
  last_error?: string | null;
}

export interface SkillInfo {
  name: string;
  description: string;
  category: string;
  enabled: boolean;
}

export interface ToolsetInfo {
  name: string;
  label: string;
  description: string;
  enabled: boolean;
  configured: boolean;
  tools: string[];
}

export interface SessionSearchResult {
  session_id: string;
  snippet: string;
  role: string | null;
  source: string | null;
  model: string | null;
  session_started: number | null;
}

export interface SessionSearchResponse {
  results: SessionSearchResult[];
}

// ── Model info types ──────────────────────────────────────────────────

export interface ModelInfoResponse {
  model: string;
  provider: string;
  auto_context_length: number;
  config_context_length: number;
  effective_context_length: number;
  capabilities: {
    supports_tools?: boolean;
    supports_vision?: boolean;
    supports_reasoning?: boolean;
    context_window?: number;
    max_output_tokens?: number;
    model_family?: string;
  };
}

// ── OAuth provider types ────────────────────────────────────────────────

export interface OAuthProviderStatus {
  logged_in: boolean;
  source?: string | null;
  source_label?: string | null;
  token_preview?: string | null;
  expires_at?: string | null;
  has_refresh_token?: boolean;
  last_refresh?: string | null;
  error?: string;
}

export interface OAuthProvider {
  id: string;
  name: string;
  /** "pkce" (browser redirect + paste code), "device_code" (show code + URL),
   *  or "external" (delegated to a separate CLI like Claude Code or Qwen). */
  flow: "pkce" | "device_code" | "external";
  cli_command: string;
  docs_url: string;
  status: OAuthProviderStatus;
}

export interface OAuthProvidersResponse {
  providers: OAuthProvider[];
}

/** Discriminated union — the shape of /start depends on the flow. */
export type OAuthStartResponse =
  | {
      session_id: string;
      flow: "pkce";
      auth_url: string;
      expires_in: number;
    }
  | {
      session_id: string;
      flow: "device_code";
      user_code: string;
      verification_url: string;
      expires_in: number;
      poll_interval: number;
    };

export interface OAuthSubmitResponse {
  ok: boolean;
  status: "approved" | "error";
  message?: string;
}

export interface OAuthPollResponse {
  session_id: string;
  status: "pending" | "approved" | "denied" | "expired" | "error";
  error_message?: string | null;
  expires_at?: number | null;
}

// ── Dashboard theme types ──────────────────────────────────────────────

export interface DashboardThemeSummary {
  description: string;
  label: string;
  name: string;
  /** Full theme definition for user themes; undefined for built-ins
   *  (which the frontend already has locally). */
  definition?: DashboardTheme;
}

export interface DashboardThemesResponse {
  active: string;
  themes: DashboardThemeSummary[];
}

// ── Dashboard plugin types ─────────────────────────────────────────────

export interface PluginManifestResponse {
  name: string;
  label: string;
  description: string;
  icon: string;
  version: string;
  tab: {
    path: string;
    position?: string;
    override?: string;
    hidden?: boolean;
  };
  entry: string;
  css?: string | null;
  has_api: boolean;
  source: string;
}
