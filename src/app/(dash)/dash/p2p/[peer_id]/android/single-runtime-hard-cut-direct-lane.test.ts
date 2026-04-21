import { readFileSync } from "node:fs";
import { access, constants } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const currentFilePath = fileURLToPath(import.meta.url);
const repoRoot = path.resolve(path.dirname(currentFilePath), "../../../../../../../");

describe("single runtime hard cut direct lane cleanup", () => {
  it("removes the deleted Android direct signal consumer path", async () => {
    await expect(fileMissing(pathInRepo("src/lib/p2p", directRequestClientFileName()))).resolves.toBe(true);
    await expect(fileMissing(pathInRepo("src/app/(dash)/dash/p2p/[peer_id]/android", androidDirectLaneHookFileName()))).resolves.toBe(true);

    expect(readRepoFile("src/app/(dash)/dash/p2p/[peer_id]/android/use-p2p-android-page-session.ts")).not.toContain(
      "useAndroid" + "DirectLane",
    );
    expect(readRepoFile("src/app/(dash)/dash/p2p/[peer_id]/android/p2p-android-native-v2-webrtc-panel.tsx")).not.toContain(
      "direct" + "Experiment",
    );
    expect(readRepoFile("src/app/(dash)/dash/p2p/[peer_id]/android/p2p-android-viewport-control-rail.tsx")).not.toContain(
      "direct" + "Experiment",
    );
    expect(readRepoFile("src/app/(dash)/dash/p2p/[peer_id]/android/android-more-panel.tsx")).not.toContain(
      "AndroidDirect" + "ExperimentPanel",
    );
  });
});

async function fileMissing(filePath: string) {
  try {
    await access(filePath, constants.F_OK);
    return false;
  } catch {
    return true;
  }
}

function pathInRepo(...segments: string[]) {
  return path.join(repoRoot, ...segments);
}

function readRepoFile(relativePath: string) {
  return readFileSync(pathInRepo(relativePath), "utf8");
}

function directRequestClientFileName() {
  return "android-" + "direct-request-client.ts";
}

function androidDirectLaneHookFileName() {
  return "use-android-" + "direct-lane.ts";
}
