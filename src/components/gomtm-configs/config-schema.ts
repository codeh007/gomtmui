import { z } from "zod";

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
  config_document: GomtmConfigDocumentSchema,
  updated_at: z.string().nullable().optional().default(null),
});

export const GomtmConfigProfileUpsertSchema = GomtmConfigProfileSchema.pick({
  name: true,
  description: true,
  config_document: true,
});

export const GomtmConfigProfileSummarySchema = GomtmConfigProfileSchema.pick({
  name: true,
  description: true,
  updated_at: true,
});

export const GomtmConfigProfileListResponseSchema = z.object({
  items: z.array(GomtmConfigProfileSummarySchema),
});

export const GomtmRuntimeUrlResponseSchema = z.object({
  runtime_url: z.string().url(),
});

export const GomtmStartupCommandResponseSchema = z.object({
  command: z.string().min(1),
});

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

export function createDefaultGomtmConfigDocument(): GomtmConfigDocument {
  return structuredClone(DEFAULT_GOMTM_CONFIG_DOCUMENT);
}

export function createDefaultGomtmConfigProfile(name = ""): GomtmConfigProfile {
  return {
    name,
    description: "",
    config_document: createDefaultGomtmConfigDocument(),
    updated_at: null,
  };
}
