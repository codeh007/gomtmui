import { describe, expect, it } from "vitest";
import YAML from "yaml";
import { ensureVmessWrapperSecret, preserveStoredVmessWrapperSecret, VmessWrapperSecretPlaceholderError } from "./vmess-wrapper-secret";

describe("ensureVmessWrapperSecret", () => {
  it("injects wrapper_secret when vmess is enabled and the field is missing", () => {
    const updated = ensureVmessWrapperSecret(
      [
        "supabase:",
        "  url: https://example.supabase.co",
        "  anon_key: anon-key",
        "mproxy:",
        "  runtime:",
        "    enable: true",
        "  entries:",
        "    plain_proxy:",
        "      enable: true",
        "      listen_host: 127.0.0.1",
        "      port: 10085",
        "    vmess:",
        "      enable: true",
        "      transport: ws",
        "",
      ].join("\n"),
      () => Buffer.alloc(32, 1),
    );

    const parsed = YAML.parse(updated) as {
      mproxy?: {
        entries?: {
          vmess?: {
            wrapper_secret?: string;
          };
        };
      };
    };

    expect(parsed.mproxy?.entries?.vmess?.wrapper_secret).toBe(Buffer.alloc(32, 1).toString("base64"));
  });

  it("preserves existing wrapper_secret values", () => {
    const updated = ensureVmessWrapperSecret(
      [
        "mproxy:",
        "  entries:",
        "    vmess:",
        "      enable: true",
        "      transport: ws",
        "      wrapper_secret: KEEP_ME",
        "",
      ].join("\n"),
      () => Buffer.alloc(32, 2),
    );

    const parsed = YAML.parse(updated) as {
      mproxy?: {
        entries?: {
          vmess?: {
            wrapper_secret?: string;
          };
        };
      };
    };

    expect(parsed.mproxy?.entries?.vmess?.wrapper_secret).toBe("KEEP_ME");
    expect(updated).not.toContain(Buffer.alloc(32, 2).toString("base64"));
  });

  it("rejects env placeholder wrapper_secret values", () => {
    expect(() =>
      ensureVmessWrapperSecret(
        [
          "mproxy:",
          "  entries:",
          "    vmess:",
          "      enable: true",
          "      transport: ws",
          "      wrapper_secret: ${env.GOMTM_VMESS_WRAPPER_SECRET}",
          "",
        ].join("\n"),
      ),
    ).toThrow(VmessWrapperSecretPlaceholderError);
  });

  it("preserves the stored wrapper_secret when an existing profile is edited", () => {
    const updated = preserveStoredVmessWrapperSecret(
      [
        "mproxy:",
        "  entries:",
        "    vmess:",
        "      enable: true",
        "      transport: ws",
        "      wrapper_secret: NEW_VALUE",
        "",
      ].join("\n"),
      [
        "mproxy:",
        "  entries:",
        "    vmess:",
        "      enable: true",
        "      transport: ws",
        "      wrapper_secret: KEEP_ME",
        "",
      ].join("\n"),
    );

    const parsed = YAML.parse(updated) as {
      mproxy?: {
        entries?: {
          vmess?: {
            wrapper_secret?: string;
          };
        };
      };
    };

    expect(parsed.mproxy?.entries?.vmess?.wrapper_secret).toBe("KEEP_ME");
  });
});
