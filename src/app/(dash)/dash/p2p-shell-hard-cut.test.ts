import { access } from "node:fs/promises";
import { constants } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { DASH_NAV_ITEMS } from "@/config/navigation";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../../..");

describe("p2p shell hard cut", () => {
  it("removes the top-level p2p route, dedicated runtime helpers, and navigation entry", async () => {
    expect(DASH_NAV_ITEMS.some((item) => item.url === "/dash/p2p")).toBe(false);

    await expect(access(path.join(root, "src/app/(dash)/dash/p2p/page.tsx"), constants.F_OK)).rejects.toBeTruthy();
    await expect(access(path.join(root, "src/app/(dash)/dash/p2p/layout.tsx"), constants.F_OK)).rejects.toBeTruthy();
    await expect(
      access(path.join(root, "src/app/(dash)/dash/p2p/runtime/use-server-shell-runtime.ts"), constants.F_OK),
    ).rejects.toBeTruthy();
    await expect(
      access(path.join(root, "src/app/(dash)/dash/p2p/runtime/p2p-runtime-provider.tsx"), constants.F_OK),
    ).rejects.toBeTruthy();
    await expect(
      access(path.join(root, "src/app/(dash)/dash/p2p/runtime/p2p-runtime-contract.ts"), constants.F_OK),
    ).rejects.toBeTruthy();
    await expect(access(path.join(root, "src/lib/p2p/server-self-node-api.ts"), constants.F_OK)).rejects.toBeTruthy();
    await expect(access(path.join(root, "src/lib/p2p/server-peer-directory-api.ts"), constants.F_OK)).rejects.toBeTruthy();
  });

  it("removes the peer detail route subtree and server operator api", async () => {
    await expect(access(path.join(root, "src/app/(dash)/dash/p2p/[peer_id]/page.tsx"), constants.F_OK)).rejects.toBeTruthy();
    await expect(
      access(path.join(root, "src/app/(dash)/dash/p2p/[peer_id]/remote/page.tsx"), constants.F_OK),
    ).rejects.toBeTruthy();
    await expect(access(path.join(root, "src/lib/p2p/server-peer-operator-api.ts"), constants.F_OK)).rejects.toBeTruthy();
  });

  it("keeps kasm-rfb assets for future work", async () => {
    await expect(access(path.join(root, "src/lib/p2p/kasm-rfb/core/rfb.js"), constants.F_OK)).resolves.toBeUndefined();
  });
});
