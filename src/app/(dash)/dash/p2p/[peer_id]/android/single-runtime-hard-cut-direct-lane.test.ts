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
    await expect(
      fileMissing(pathInRepo("src/app/(dash)/dash/p2p/[peer_id]/android", "p2p-android-native-v2-webrtc-panel.tsx")),
    ).resolves.toBe(true);
    await expect(
      fileMissing(pathInRepo("src/app/(dash)/dash/p2p/[peer_id]/android", "android-more-panel.tsx")),
    ).resolves.toBe(true);
    await expect(
      fileMissing(pathInRepo("src/app/(dash)/dash/p2p/[peer_id]/android", "p2p-android-viewport-control-rail.tsx")),
    ).resolves.toBe(true);
    await expect(
      fileMissing(pathInRepo("src/app/(dash)/dash/p2p/[peer_id]/android", "android-device-navigation-bar.tsx")),
    ).resolves.toBe(true);
    await expect(
      fileMissing(pathInRepo("src/app/(dash)/dash/p2p/[peer_id]/android", "android-more-panel-actions.ts")),
    ).resolves.toBe(true);
    await expect(
      fileMissing(pathInRepo("src/app/(dash)/dash/p2p/[peer_id]/android", "android-more-panel-state.ts")),
    ).resolves.toBe(true);
    await expect(
      fileMissing(pathInRepo("src/app/(dash)/dash/p2p/[peer_id]/android", "android-session-info-dialog.tsx")),
    ).resolves.toBe(true);
    await expect(
      fileMissing(pathInRepo("src/app/(dash)/dash/p2p/[peer_id]/android", "android-session-info-section.tsx")),
    ).resolves.toBe(true);
    await expect(
      fileMissing(pathInRepo("src/app/(dash)/dash/p2p/[peer_id]/android", "android-text-composer-action.tsx")),
    ).resolves.toBe(true);
    await expect(
      fileMissing(pathInRepo("src/app/(dash)/dash/p2p/[peer_id]/android", "android-keyboard-bridge.tsx")),
    ).resolves.toBe(true);
    await expect(
      fileMissing(pathInRepo("src/app/(dash)/dash/p2p/[peer_id]/android", "android-native-v2-status-overlay.tsx")),
    ).resolves.toBe(true);
    await expect(
      fileMissing(pathInRepo("src/app/(dash)/dash/p2p/[peer_id]/android", "android-session-model.ts")),
    ).resolves.toBe(true);
    await expect(
      fileMissing(pathInRepo("src/app/(dash)/dash/p2p/[peer_id]/android", "p2p-android-viewport-support.ts")),
    ).resolves.toBe(true);
    await expect(
      fileMissing(pathInRepo("src/app/(dash)/dash/p2p/[peer_id]/android", "p2p-android-native-v2-webrtc-panel-shared.ts")),
    ).resolves.toBe(true);
    await expect(
      fileMissing(pathInRepo("src/app/(dash)/dash/p2p/[peer_id]/android", "p2p-android-native-v2-webrtc-panel-utils.ts")),
    ).resolves.toBe(true);
    await expect(
      fileMissing(pathInRepo("src/app/(dash)/dash/p2p/[peer_id]/android", "native-android-video-renderer.ts")),
    ).resolves.toBe(true);
    await expect(
      fileMissing(pathInRepo("src/app/(dash)/dash/p2p/[peer_id]/android", "use-is-narrow-screen.ts")),
    ).resolves.toBe(true);
    await expect(
      fileMissing(pathInRepo("src/app/(dash)/dash/p2p/[peer_id]/android", "android-direct-experiment-panel-utils.ts")),
    ).resolves.toBe(true);

    expect(readRepoFile("src/app/(dash)/dash/p2p/[peer_id]/android/use-p2p-android-page-session.ts")).not.toContain(
      "useAndroid" + "DirectLane",
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
