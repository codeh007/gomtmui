import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const deployWorkflow = readFileSync(new URL("../../../../.github/workflows/deploy.yml", import.meta.url), "utf8");

describe("gomtmui deploy workflow", () => {
  it("injects the runtime config signing secret into worker runtime secrets", () => {
    expect(deployWorkflow).toContain("GOMTM_RUNTIME_CONFIG_SIGNING_SECRET: ${{ secrets.GOMTM_RUNTIME_CONFIG_SIGNING_SECRET }}");
    expect(deployWorkflow).toContain("GOMTM_RUNTIME_CONFIG_SIGNING_SECRET=${GOMTM_RUNTIME_CONFIG_SIGNING_SECRET}");
  });
});
