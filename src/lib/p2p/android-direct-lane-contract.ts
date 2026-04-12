export type DirectCandidateType = "host" | "srflx" | "prflx" | "relay" | "unknown";

export type DirectCandidatePairEvidence = {
  localCandidateType: DirectCandidateType;
  remoteCandidateType: DirectCandidateType;
  selectedPairType: "direct" | "relay" | "unknown";
};

export function classifyDirectEvidence(evidence: DirectCandidatePairEvidence) {
  const { localCandidateType, remoteCandidateType, selectedPairType } = evidence;

  if (selectedPairType === "relay" || localCandidateType === "relay" || remoteCandidateType === "relay") {
    return {
      isDirect: false,
      provesHolePunching: false,
      summary: "relay" as const,
    };
  }

  const isDirect = selectedPairType === "direct";
  const provesHolePunching =
    isDirect &&
    (localCandidateType === "srflx" ||
      localCandidateType === "prflx" ||
      remoteCandidateType === "srflx" ||
      remoteCandidateType === "prflx");

  return {
    isDirect,
    provesHolePunching,
    summary: `${localCandidateType}->${remoteCandidateType}`,
  };
}
