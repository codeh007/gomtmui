import { classifyDirectEvidence, type DirectCandidateType } from "@/lib/p2p/android-direct-lane-contract";

export const STALE_ATTEMPT_REASON = "当前结果已被新的 direct 尝试取代。";

export type AndroidDirectLaneStatsSummary = {
  candidatePairSummary: string;
  directEvidenceSummary: string;
  isDirect: boolean;
  reason: string;
};

export function normalizeDirectCandidateType(value: unknown): DirectCandidateType {
  const normalized = typeof value === "string" ? value.trim().toLowerCase() : "";
  switch (normalized) {
    case "host":
    case "prflx":
    case "relay":
    case "srflx":
      return normalized;
    default:
      return "unknown";
  }
}

export function summarizeDirectConnectionStats(report: unknown): AndroidDirectLaneStatsSummary {
  const entries: Array<Record<string, unknown>> = [];
  if (report != null && typeof report === "object" && "forEach" in report && typeof report.forEach === "function") {
    report.forEach((value: unknown) => {
      if (value != null && typeof value === "object") {
        entries.push(value as Record<string, unknown>);
      }
    });
  }

  const byId = new Map<string, Record<string, unknown>>();
  for (const entry of entries) {
    const id = typeof entry.id === "string" ? entry.id : null;
    if (id != null) {
      byId.set(id, entry);
    }
  }

  let selectedPair: Record<string, unknown> | null = null;
  for (const entry of entries) {
    if (entry.type !== "transport") {
      continue;
    }
    const selectedCandidatePairId =
      typeof entry.selectedCandidatePairId === "string" ? entry.selectedCandidatePairId : null;
    if (selectedCandidatePairId == null) {
      continue;
    }
    selectedPair = byId.get(selectedCandidatePairId) ?? null;
    if (selectedPair != null) {
      break;
    }
  }
  if (selectedPair == null) {
    for (const entry of entries) {
      if (entry.type !== "candidate-pair") {
        continue;
      }
      if (entry.state === "succeeded") {
        selectedPair = entry;
        break;
      }
    }
  }

  if (selectedPair == null) {
    return {
      candidatePairSummary: "尚无 selected candidate pair",
      directEvidenceSummary: "尚无 direct 证据",
      isDirect: false,
      reason: "尚无 selected candidate pair，无法证明 direct path。",
    };
  }

  const localCandidateId = typeof selectedPair.localCandidateId === "string" ? selectedPair.localCandidateId : null;
  const remoteCandidateId = typeof selectedPair.remoteCandidateId === "string" ? selectedPair.remoteCandidateId : null;
  const localCandidate = localCandidateId == null ? null : (byId.get(localCandidateId) ?? null);
  const remoteCandidate = remoteCandidateId == null ? null : (byId.get(remoteCandidateId) ?? null);
  const localCandidateType = normalizeDirectCandidateType(localCandidate?.candidateType);
  const remoteCandidateType = normalizeDirectCandidateType(remoteCandidate?.candidateType);
  const selectedPairType =
    localCandidateType === "relay" || remoteCandidateType === "relay"
      ? "relay"
      : localCandidateId != null && remoteCandidateId != null
        ? "direct"
        : "unknown";
  const classification = classifyDirectEvidence({
    localCandidateType,
    remoteCandidateType,
    selectedPairType,
  });

  return {
    candidatePairSummary: `selected pair: ${localCandidateType}->${remoteCandidateType}`,
    directEvidenceSummary: classification.provesHolePunching
      ? "hole punching confirmed"
      : classification.isDirect
        ? "direct path confirmed"
        : classification.summary === "relay"
          ? "relay candidate pair selected"
          : "direct path not proven",
    isDirect: classification.isDirect,
    reason: classification.isDirect ? "" : `selected candidate pair 未证明 direct path: ${classification.summary}`,
  };
}
