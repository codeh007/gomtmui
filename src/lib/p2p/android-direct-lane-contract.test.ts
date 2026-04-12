import { describe, expect, it } from "vitest";
import { classifyDirectEvidence, type DirectCandidatePairEvidence } from "./android-direct-lane-contract";

describe("classifyDirectEvidence", () => {
  it("rejects relay candidate pairs for the direct-only experiment", () => {
    const evidence: DirectCandidatePairEvidence = {
      localCandidateType: "host",
      remoteCandidateType: "relay",
      selectedPairType: "relay",
    };

    expect(classifyDirectEvidence(evidence)).toEqual({
      isDirect: false,
      provesHolePunching: false,
      summary: "relay",
    });
  });

  it("marks srflx/prflx pairs as direct and hole-punch-proven", () => {
    const evidence: DirectCandidatePairEvidence = {
      localCandidateType: "srflx",
      remoteCandidateType: "prflx",
      selectedPairType: "direct",
    };

    expect(classifyDirectEvidence(evidence)).toEqual({
      isDirect: true,
      provesHolePunching: true,
      summary: "srflx->prflx",
    });
  });

  it("does not mark hole punching as proven before a direct pair is selected", () => {
    const evidence: DirectCandidatePairEvidence = {
      localCandidateType: "srflx",
      remoteCandidateType: "prflx",
      selectedPairType: "unknown",
    };

    expect(classifyDirectEvidence(evidence)).toEqual({
      isDirect: false,
      provesHolePunching: false,
      summary: "srflx->prflx",
    });
  });
});
