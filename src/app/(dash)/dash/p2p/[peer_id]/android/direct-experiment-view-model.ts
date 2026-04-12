import type { P2PAndroidDirectExperimentView } from "./p2p-android-viewport-stage";
import type { AndroidDirectLaneState } from "./use-android-direct-lane";

type DirectExperimentInput = {
  candidatePairSummary?: string | null;
  directEvidenceSummary?: string | null;
  lastError?: string | null;
  lastResult?: unknown;
  runDirectExperiment?: () => Promise<{ path: string; reason?: string }>;
  state?: AndroidDirectLaneState;
};

export function buildDirectExperimentViewModel({
  candidatePairSummary,
  directEvidenceSummary,
  lastError,
  lastResult,
  runDirectExperiment,
  state,
}: DirectExperimentInput): P2PAndroidDirectExperimentView | undefined {
  if (runDirectExperiment == null && lastResult == null && lastError == null && state == null) {
    return undefined;
  }

  return {
    candidatePairSummary: candidatePairSummary ?? "尚无 candidate pair",
    canRun: runDirectExperiment != null,
    directEvidenceSummary: directEvidenceSummary ?? "尚无 direct 证据",
    lastError: lastError ?? null,
    lastResult: lastResult ?? null,
    onRun: runDirectExperiment ?? (() => undefined),
    state: state ?? "idle",
  };
}
