import { z } from "zod";

// Postgres UUIDs don't always strictly follow RFC 4122 (e.g. version bits), so we use a regex
const LooseUUID = z
  .string()
  .regex(/^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/, "Invalid UUID format");

export const SysLogMetaSchema = z.union([
  z.object({
    event_type: z.literal("tunnel_setup_failed"),
    instance_id: LooseUUID,
    instance_name: z.string(),
    error: z.string().nullable().optional(),
    response: z.any().nullable().optional(),
  }),
  // Fallback for other event types or unknown structures
  z
    .object({
      event_type: z.string(),
    })
    .loose(),
]);

export type SysLogMeta = z.infer<typeof SysLogMetaSchema>;

export const TunnelSetupFailedMetaSchema = z.object({
  instance_id: LooseUUID,
  instance_name: z.string(),
  error: z.string().nullable().optional(),
  response: z.any().nullable().optional(),
});
