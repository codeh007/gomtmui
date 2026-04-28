import { parse, stringify } from "yaml";
import { z } from "zod";

export const gomtmConfigTargetKinds = ["generic", "linux", "android"] as const;

export const GomtmConfigTargetKindSchema = z.enum(gomtmConfigTargetKinds);

export const GomtmConfigDocumentSchema = z.object({
  server: z.object({
    listen: z.string(),
    instance_id: z.string(),
    storage: z.object({
      root_dir: z.string(),
    }),
  }),
  supabase: z.object({
    url: z.string(),
    anon_key: z.string(),
    service_role_key: z.string(),
  }),
  cloudflare: z.object({
    cloudflare_api_token: z.string(),
    cloudflare_account_id: z.string(),
    cloudflare_zone_id: z.string(),
    tunnel_domain: z.string(),
  }),
  mtmai: z.object({
    hermes_gateway: z.object({
      enable: z.boolean(),
    }),
  }),
});

export const GomtmConfigProfileSchema = z.object({
  name: z.string().min(1),
  description: z.string().default(""),
  target_kind: GomtmConfigTargetKindSchema.default("generic"),
  config_yaml: z.string().min(1),
  status: z.string().optional().default("draft"),
  current_version: z.number().nullable().optional().default(null),
  published_version: z.number().nullable().optional().default(null),
  updated_at: z.string().nullable().optional().default(null),
});

export const GomtmConfigProfileUpsertSchema = GomtmConfigProfileSchema.pick({
  name: true,
  description: true,
  target_kind: true,
  config_yaml: true,
});

export const GomtmConfigProfileSummarySchema = GomtmConfigProfileSchema.pick({
  name: true,
  description: true,
  target_kind: true,
  status: true,
  current_version: true,
  published_version: true,
  updated_at: true,
});

export const GomtmConfigProfileListResponseSchema = z.object({
  items: z.array(GomtmConfigProfileSummarySchema),
});

export const GomtmRuntimeUrlResponseSchema = z.object({
  runtime_url: z.string().url(),
});

export type GomtmConfigTargetKind = z.infer<typeof GomtmConfigTargetKindSchema>;
export type GomtmConfigDocument = z.infer<typeof GomtmConfigDocumentSchema>;
export type GomtmConfigProfile = z.infer<typeof GomtmConfigProfileSchema>;
export type GomtmConfigProfileUpsert = z.infer<typeof GomtmConfigProfileUpsertSchema>;

const DEFAULT_GOMTM_CONFIG_DOCUMENT: GomtmConfigDocument = {
  server: {
    listen: "",
    instance_id: "",
    storage: {
      root_dir: "",
    },
  },
  supabase: {
    url: "",
    anon_key: "",
    service_role_key: "",
  },
  cloudflare: {
    cloudflare_api_token: "",
    cloudflare_account_id: "",
    cloudflare_zone_id: "",
    tunnel_domain: "",
  },
  mtmai: {
    hermes_gateway: {
      enable: false,
    },
  },
};

type ConfigRecord = Record<string, unknown>;

function isRecord(value: unknown): value is ConfigRecord {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function getNestedValue(source: ConfigRecord, path: string[]) {
  let current: unknown = source;
  for (const segment of path) {
    if (!isRecord(current)) {
      return undefined;
    }
    current = current[segment];
  }
  return current;
}

function readString(source: ConfigRecord, path: string[]) {
  const value = getNestedValue(source, path);
  return typeof value === "string" ? value : "";
}

function readBoolean(source: ConfigRecord, path: string[]) {
  const value = getNestedValue(source, path);
  return typeof value === "boolean" ? value : false;
}

function setNestedValue(target: ConfigRecord, path: string[], value: unknown) {
  let current: ConfigRecord = target;

  for (const segment of path.slice(0, -1)) {
    const nextValue = current[segment];
    if (!isRecord(nextValue)) {
      current[segment] = {};
    }
    current = current[segment] as ConfigRecord;
  }

  current[path[path.length - 1]] = value;
}

function normalizeRawConfigSource(source: unknown): ConfigRecord {
  if (!isRecord(source)) {
    throw new Error("YAML 顶层必须是对象");
  }

  return source;
}

export function createDefaultGomtmConfigProfile(name = ""): GomtmConfigProfile {
  return {
    name,
    description: "",
    target_kind: "generic",
    config_yaml: "kind: worker\nname: " + (name || "custom1") + "\n",
    status: "draft",
    current_version: null,
    published_version: null,
    updated_at: null,
  };
}

export function createDefaultGomtmConfigDocument(): GomtmConfigDocument {
  return structuredClone(DEFAULT_GOMTM_CONFIG_DOCUMENT);
}

export function parseGomtmConfigYaml(configYaml: string): ConfigRecord {
  return normalizeRawConfigSource(parse(configYaml));
}

export function resolveGomtmConfigSource(profile: Pick<GomtmConfigProfile, "config_yaml">): ConfigRecord {
  return parseGomtmConfigYaml(profile.config_yaml);
}

export function extractGomtmConfigDocument(source: ConfigRecord): GomtmConfigDocument {
  return GomtmConfigDocumentSchema.parse({
    server: {
      listen: readString(source, ["server", "listen"]),
      instance_id: readString(source, ["server", "instance_id"]),
      storage: {
        root_dir: readString(source, ["server", "storage", "root_dir"]),
      },
    },
    supabase: {
      url: readString(source, ["supabase", "url"]),
      anon_key: readString(source, ["supabase", "anon_key"]),
      service_role_key: readString(source, ["supabase", "service_role_key"]),
    },
    cloudflare: {
      cloudflare_api_token: readString(source, ["cloudflare", "cloudflare_api_token"]),
      cloudflare_account_id: readString(source, ["cloudflare", "cloudflare_account_id"]),
      cloudflare_zone_id: readString(source, ["cloudflare", "cloudflare_zone_id"]),
      tunnel_domain: readString(source, ["cloudflare", "tunnel_domain"]),
    },
    mtmai: {
      hermes_gateway: {
        enable: readBoolean(source, ["mtmai", "hermes_gateway", "enable"]),
      },
    },
  });
}

export function overlayGomtmConfigDocument(baseSource: ConfigRecord, document: GomtmConfigDocument): ConfigRecord {
  const nextSource = structuredClone(baseSource);

  setNestedValue(nextSource, ["server", "listen"], document.server.listen);
  setNestedValue(nextSource, ["server", "instance_id"], document.server.instance_id);
  setNestedValue(nextSource, ["server", "storage", "root_dir"], document.server.storage.root_dir);
  setNestedValue(nextSource, ["supabase", "url"], document.supabase.url);
  setNestedValue(nextSource, ["supabase", "anon_key"], document.supabase.anon_key);
  setNestedValue(nextSource, ["supabase", "service_role_key"], document.supabase.service_role_key);
  setNestedValue(nextSource, ["cloudflare", "cloudflare_api_token"], document.cloudflare.cloudflare_api_token);
  setNestedValue(nextSource, ["cloudflare", "cloudflare_account_id"], document.cloudflare.cloudflare_account_id);
  setNestedValue(nextSource, ["cloudflare", "cloudflare_zone_id"], document.cloudflare.cloudflare_zone_id);
  setNestedValue(nextSource, ["cloudflare", "tunnel_domain"], document.cloudflare.tunnel_domain);
  setNestedValue(nextSource, ["mtmai", "hermes_gateway", "enable"], document.mtmai.hermes_gateway.enable);

  return nextSource;
}

export function stringifyGomtmConfigSource(source: ConfigRecord) {
  return stringify(source, {
    defaultKeyType: "PLAIN",
    defaultStringType: "QUOTE_DOUBLE",
    lineWidth: 0,
  });
}
