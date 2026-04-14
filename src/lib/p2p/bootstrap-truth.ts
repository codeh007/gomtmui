import { z } from "zod";
import { normalizeBrowserMultiaddr, sameBrowserMultiaddr } from "./browser-multiaddr";

const browserBootstrapTransportSchema = z.enum(["webtransport", "wss"]);

const browserBootstrapCandidateBaseSchema = z.object({
  transport: browserBootstrapTransportSchema,
  addr: z.string().trim().min(1),
  priority: z.number(),
});

export const browserBootstrapCandidateSchema = browserBootstrapCandidateBaseSchema.transform((candidate) => ({
  ...candidate,
  addr: normalizeBrowserMultiaddr(candidate.addr),
}));

export type BrowserBootstrapCandidate = z.output<typeof browserBootstrapCandidateSchema>;

export const browserBootstrapTruthSchema = z.object({
  generation: z.string().trim().min(1),
  primaryTransport: browserBootstrapTransportSchema,
  candidates: z.array(browserBootstrapCandidateSchema).min(1),
});

export type BrowserBootstrapTruth = z.infer<typeof browserBootstrapTruthSchema>;

export const browserBootstrapTruthWireSchema = z
  .object({
    generation: z.string().trim().min(1),
    primary_transport: browserBootstrapTransportSchema,
    candidates: z.array(browserBootstrapCandidateBaseSchema).min(1),
  })
  .transform((truth) =>
    browserBootstrapTruthSchema.parse({
      generation: truth.generation,
      primaryTransport: truth.primary_transport,
      candidates: truth.candidates,
    }),
  );

export type CanonicalBootstrapState =
  | {
      mode: "live";
      selected: BrowserBootstrapCandidate;
      staleStoredBootstrapAddr: string | null;
      blockedOverrideBootstrapAddr: null;
    }
  | {
      mode: "missing-live-truth";
      selected: null;
      staleStoredBootstrapAddr: null;
      blockedOverrideBootstrapAddr: null;
    }
  | {
      mode: "blocked-override";
      selected: null;
      staleStoredBootstrapAddr: string | null;
      blockedOverrideBootstrapAddr: string;
    };

export function parseBrowserBootstrapTruth(value: unknown) {
  return browserBootstrapTruthWireSchema.parse(value);
}

export function parseMaybeBrowserBootstrapTruth(value: unknown) {
  if (value == null) {
    return null;
  }

  return parseBrowserBootstrapTruth(value);
}

function normalizeOptionalBrowserMultiaddr(value: string | null | undefined) {
  const trimmed = value?.trim();
  return trimmed ? normalizeBrowserMultiaddr(trimmed) : null;
}

function pickPrimaryCandidate(liveTruth: BrowserBootstrapTruth) {
  return (
    liveTruth.candidates.find((candidate) => candidate.transport === liveTruth.primaryTransport) ?? liveTruth.candidates[0]
  );
}

export function resolveCanonicalBootstrapState(input: {
  liveTruth: BrowserBootstrapTruth | null;
  storedBootstrapAddr: string | null;
  overrideBootstrapAddr: string | null;
  allowOverride: boolean;
}): CanonicalBootstrapState {
  if (input.liveTruth == null) {
    return {
      mode: "missing-live-truth",
      selected: null,
      staleStoredBootstrapAddr: null,
      blockedOverrideBootstrapAddr: null,
    };
  }

  const storedBootstrapAddr = normalizeOptionalBrowserMultiaddr(input.storedBootstrapAddr);
  const overrideBootstrapAddr = normalizeOptionalBrowserMultiaddr(input.overrideBootstrapAddr);
  const liveCandidates = input.liveTruth.candidates;

  const staleStoredBootstrapAddr =
    storedBootstrapAddr != null &&
    !liveCandidates.some((candidate) => sameBrowserMultiaddr(candidate.addr, storedBootstrapAddr))
      ? storedBootstrapAddr
      : null;

  if (
    overrideBootstrapAddr != null &&
    !input.allowOverride &&
    !liveCandidates.some((candidate) => sameBrowserMultiaddr(candidate.addr, overrideBootstrapAddr))
  ) {
    return {
      mode: "blocked-override",
      selected: null,
      staleStoredBootstrapAddr,
      blockedOverrideBootstrapAddr: overrideBootstrapAddr,
    };
  }

  return {
    mode: "live",
    selected: pickPrimaryCandidate(input.liveTruth),
    staleStoredBootstrapAddr,
    blockedOverrideBootstrapAddr: null,
  };
}
