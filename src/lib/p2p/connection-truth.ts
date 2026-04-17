import { z } from "zod";
import { normalizeBrowserMultiaddr, sameBrowserMultiaddr } from "./browser-multiaddr";

const browserConnectionTransportSchema = z.enum(["webtransport", "ws"]);

function hasProtocolSegment(value: string, protocol: string) {
  return value.split("/").includes(protocol);
}

const browserConnectionCandidateBaseSchema = z
  .object({
    transport: browserConnectionTransportSchema,
    addr: z.string().trim().min(1),
    priority: z.number(),
  })
  .superRefine((candidate, ctx) => {
    if (candidate.transport !== "ws") {
      return;
    }

    if (hasProtocolSegment(candidate.addr, "tls") || hasProtocolSegment(candidate.addr, "wss")) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'ws transport must use canonical /ws multiaddr without legacy secure websocket segments',
        path: ["addr"],
      });
    }
  });

export const browserConnectionCandidateSchema = browserConnectionCandidateBaseSchema.transform((candidate) => ({
  ...candidate,
  addr: normalizeBrowserMultiaddr(candidate.addr),
}));

export type BrowserConnectionCandidate = z.output<typeof browserConnectionCandidateSchema>;

export const browserConnectionTruthSchema = z.object({
  generation: z.string().trim().min(1),
  primaryTransport: browserConnectionTransportSchema,
  candidates: z.array(browserConnectionCandidateSchema).min(1),
});

export type BrowserConnectionTruth = z.infer<typeof browserConnectionTruthSchema>;

export const browserConnectionTruthWireSchema = z
  .object({
    generation: z.string().trim().min(1),
    primary_transport: browserConnectionTransportSchema,
    candidates: z.array(browserConnectionCandidateBaseSchema).min(1),
  })
  .transform((truth) =>
    browserConnectionTruthSchema.parse({
      generation: truth.generation,
      primaryTransport: truth.primary_transport,
      candidates: truth.candidates,
    }),
  );

export type CanonicalConnectionState =
  | {
      mode: "live";
      selected: BrowserConnectionCandidate;
      staleStoredConnectionAddr: string | null;
      blockedOverrideConnectionAddr: null;
    }
  | {
      mode: "missing-live-truth";
      selected: null;
      staleStoredConnectionAddr: null;
      blockedOverrideConnectionAddr: null;
    }
  | {
      mode: "blocked-override";
      selected: null;
      staleStoredConnectionAddr: string | null;
      blockedOverrideConnectionAddr: string;
    };

export type PublicConnectionMetadata = {
  version: number;
  server: {
    publicUrl: string | null;
  };
  p2p: {
    enabled: boolean;
    generation: string | null;
  };
  browser: BrowserConnectionTruth | null;
};

const publicConnectionMetadataV2WireSchema = z.object({
  version: z.number().int(),
  server: z
    .object({
      public_url: z.string().trim().min(1).optional(),
    })
    .optional(),
  p2p: z
    .object({
      enabled: z.boolean(),
      generation: z.string().trim().min(1).optional(),
    })
    .optional(),
  browser: browserConnectionTruthWireSchema,
});

export function parseBrowserConnectionTruth(value: unknown) {
  return browserConnectionTruthWireSchema.parse(value);
}

export function parseMaybeBrowserConnectionTruth(value: unknown) {
  if (value == null) {
    return null;
  }

  return parseBrowserConnectionTruth(value);
}

export function parsePublicConnectionMetadata(value: unknown): PublicConnectionMetadata {
  const parsed = publicConnectionMetadataV2WireSchema.parse(value);
  return {
    version: parsed.version,
    server: {
      publicUrl: parsed.server?.public_url?.trim() || null,
    },
    p2p: {
      enabled: parsed.p2p?.enabled ?? false,
      generation: parsed.p2p?.generation?.trim() || null,
    },
    browser: parsed.browser,
  };
}

function normalizeOptionalBrowserMultiaddr(value: string | null | undefined) {
  const trimmed = value?.trim();
  return trimmed ? normalizeBrowserMultiaddr(trimmed) : null;
}

function pickPrimaryCandidate(liveTruth: BrowserConnectionTruth) {
  return (
    liveTruth.candidates.find((candidate) => candidate.transport === liveTruth.primaryTransport) ?? liveTruth.candidates[0]
  );
}

export function resolveCanonicalConnectionState(input: {
  liveTruth: BrowserConnectionTruth | null;
  storedConnectionAddr: string | null;
  overrideConnectionAddr: string | null;
  allowOverride: boolean;
}): CanonicalConnectionState {
  if (input.liveTruth == null) {
    return {
      mode: "missing-live-truth",
      selected: null,
      staleStoredConnectionAddr: null,
      blockedOverrideConnectionAddr: null,
    };
  }

  const storedConnectionAddr = normalizeOptionalBrowserMultiaddr(input.storedConnectionAddr);
  const overrideConnectionAddr = normalizeOptionalBrowserMultiaddr(input.overrideConnectionAddr);
  const liveCandidates = input.liveTruth.candidates;

  const staleStoredConnectionAddr =
    storedConnectionAddr != null &&
    !liveCandidates.some((candidate) => sameBrowserMultiaddr(candidate.addr, storedConnectionAddr))
      ? storedConnectionAddr
      : null;

  if (
    overrideConnectionAddr != null &&
    !input.allowOverride &&
    !liveCandidates.some((candidate) => sameBrowserMultiaddr(candidate.addr, overrideConnectionAddr))
  ) {
    return {
      mode: "blocked-override",
      selected: null,
      staleStoredConnectionAddr,
      blockedOverrideConnectionAddr: overrideConnectionAddr,
    };
  }

  return {
    mode: "live",
    selected: pickPrimaryCandidate(input.liveTruth),
    staleStoredConnectionAddr,
    blockedOverrideConnectionAddr: null,
  };
}
