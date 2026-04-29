import { describe, expect, it } from "vitest";
import { buildManagedLinuxStartupCommand } from "./command";

describe("buildManagedLinuxStartupCommand", () => {
  it("includes config URI and bootstrap credential", () => {
    const command = buildManagedLinuxStartupCommand({
      configUrl: "https://gomtmui-dev.yuepa8.com/api/cf/gomtm/runtime-configs/new-config?sig=abc",
      bootstrapCredential: "gbr_demo",
      deviceNameExpression: "$(hostname)",
    });

    expect(command).toContain('--config="https://gomtmui-dev.yuepa8.com/api/cf/gomtm/runtime-configs/new-config?sig=abc"');
    expect(command).toContain('--bootstrap-credential="gbr_demo"');
    expect(command).toContain('--device-name="$(hostname)"');
  });

  it("escapes hostile values so the shell treats them as data", () => {
    const command = buildManagedLinuxStartupCommand({
      configUrl: 'https://gomtmui-dev.yuepa8.com/api/cf/gomtm/runtime-configs/new-config?sig=$(touch /tmp/pwned)&note="quoted"',
      bootstrapCredential: 'gbr_demo$(touch /tmp/pwned)`uname`"quoted"',
      deviceNameExpression: '$(touch /tmp/pwned)"quoted"`uname`',
    });

    expect(command).toContain('--config="https://gomtmui-dev.yuepa8.com/api/cf/gomtm/runtime-configs/new-config?sig=\\$(touch /tmp/pwned)&note=\\"quoted\\""');
    expect(command).toContain('--bootstrap-credential="gbr_demo\\$(touch /tmp/pwned)\\`uname\\`\\"quoted\\""');
    expect(command).toContain('--device-name="\\$(touch /tmp/pwned)\\"quoted\\"\\`uname\\`"');
  });
});
