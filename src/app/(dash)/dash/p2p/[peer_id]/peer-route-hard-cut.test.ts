import { access } from "node:fs/promises";
import { constants } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../../../../../..");

describe("peer route hard cut", () => {
  it("removes the Android route subtree", async () => {
    await expect(access(path.join(root, "src/app/(dash)/dash/p2p/[peer_id]/android/page.tsx"), constants.F_OK)).rejects.toBeTruthy();
    await expect(
      access(path.join(root, "src/app/(dash)/dash/p2p/[peer_id]/android/use-p2p-android-page-session.ts"), constants.F_OK),
    ).rejects.toBeTruthy();
    await expect(
      access(
        path.join(root, "src/app/(dash)/dash/p2p/[peer_id]/android/p2p-android-page-session-view-model.ts"),
        constants.F_OK,
      ),
    ).rejects.toBeTruthy();
    await expect(
      access(path.join(root, "src/app/(dash)/dash/p2p/[peer_id]/android/single-runtime-hard-cut-direct-lane.test.ts"), constants.F_OK),
    ).rejects.toBeTruthy();
  });
});
