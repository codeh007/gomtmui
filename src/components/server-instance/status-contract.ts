import {
  type ServerInstanceGetReturns,
  type ServerInstanceListReturns,
  serverInstanceGetResultSchema,
  serverInstanceListItemSchema,
} from "mtmsdk/types/contracts";
import { z } from "zod";

const nullableStringSchema = z.string().nullable().optional();

export const serverInstanceStatusSchema = z.object({
  id: z.string(),
  status: nullableStringSchema,
  status_reason: nullableStringSchema,
  status_source: nullableStringSchema,
  hostname: nullableStringSchema,
  platform: nullableStringSchema,
  bootstrap_mode: nullableStringSchema,
  updated_at: nullableStringSchema,
  created_at: nullableStringSchema,
});

export type ServerInstanceStatusDto = z.infer<typeof serverInstanceStatusSchema>;

export type ServerStatusVariant = "ready" | "bootstrapping" | "bootstrap_failed" | "offline" | "unknown";

export type ServerStatusCopy = {
  variant: ServerStatusVariant;
  title: string;
  compactLabel: string;
};

export const serverInstanceListSchema = z
  .array(serverInstanceListItemSchema)
  .transform((rows) => rows.map(buildServerInstanceStatusDto));

export const serverInstanceDetailSchema = z
  .array(serverInstanceGetResultSchema)
  .transform((rows) => (rows[0] ? buildServerInstanceStatusDto(rows[0]) : null));

type ServerInstanceRawRow = ServerInstanceGetReturns | ServerInstanceListReturns;

type ServerStatusLike = Pick<ServerInstanceStatusDto, "status" | "status_reason" | "status_source">;

export type ServerStatusReasonDisplay = {
  label: "状态原因" | "离线原因";
  reason: string;
};

function asRecord(value: unknown) {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }

  return {};
}

function readString(value: unknown) {
  return typeof value === "string" ? value : undefined;
}

function readNestedString(source: Record<string, unknown>, ...path: string[]) {
  let current: unknown = source;

  for (const key of path) {
    current = asRecord(current)[key];
  }

  return readString(current);
}

function pickNonEmpty(...values: Array<string | null | undefined>) {
  for (const value of values) {
    const trimmed = value?.trim();
    if (trimmed) {
      return trimmed;
    }
  }

  return undefined;
}

export function getServerStatusReason(status: ServerStatusLike | null | undefined) {
  return pickNonEmpty(status?.status_reason);
}

export function getServerStatusSource(status: ServerStatusLike | null | undefined) {
  return pickNonEmpty(status?.status_source);
}

export function getServerStatusReasonDisplay(
  status: ServerStatusLike | null | undefined,
): ServerStatusReasonDisplay | undefined {
  const reason = getServerStatusReason(status);
  const variant = getServerStatusVariant(status?.status);

  if (!reason || (variant !== "bootstrap_failed" && variant !== "offline")) {
    return undefined;
  }

  return {
    label: variant === "offline" ? "离线原因" : "状态原因",
    reason,
  };
}

export function getServerAccessUrl(status: string | null | undefined, hostname: string | null | undefined) {
  const normalizedStatus = status?.trim();
  const normalizedHostname = hostname?.trim();

  if (normalizedStatus !== "ready" || !normalizedHostname) {
    return undefined;
  }

  return `https://${normalizedHostname}`;
}

export function getServerStatusVariant(status: string | null | undefined): ServerStatusVariant {
  switch (status) {
    case "ready":
      return "ready";
    case "bootstrapping":
      return "bootstrapping";
    case "bootstrap_failed":
      return "bootstrap_failed";
    case "offline":
      return "offline";
    default:
      return "unknown";
  }
}

export function getServerStatusCopy(status: string | null | undefined): ServerStatusCopy {
  const variant = getServerStatusVariant(status);

  switch (variant) {
    case "ready":
      return {
        variant,
        title: "实例已就绪",
        compactLabel: "已就绪",
      };
    case "bootstrapping":
      return {
        variant,
        title: "实例引导中",
        compactLabel: "引导中",
      };
    case "bootstrap_failed":
      return {
        variant,
        title: "实例引导失败",
        compactLabel: "引导失败",
      };
    case "offline":
      return {
        variant,
        title: "实例已离线",
        compactLabel: "已离线",
      };
    default:
      return {
        variant,
        title: "实例状态未知",
        compactLabel: "状态未知",
      };
  }
}

export function buildServerInstanceStatusDto(row: ServerInstanceRawRow): ServerInstanceStatusDto {
  const config = asRecord(row.config);
  const state = asRecord(row.state);

  return serverInstanceStatusSchema.parse({
    id: row.id,
    status: readString(state.status),
    status_reason: getServerStatusReason({
      status_reason: readString(state.status_reason),
    }),
    status_source: getServerStatusSource({
      status_source: readString(state.status_source),
    }),
    hostname: readNestedString(config, "tunnel", "hostname"),
    platform: readString(config.platform),
    bootstrap_mode: readString(config.bootstrap_mode),
    updated_at: row.updated_at,
    created_at: row.created_at,
  });
}
