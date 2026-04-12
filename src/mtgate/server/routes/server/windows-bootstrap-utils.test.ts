import { describe, expect, it } from "vitest";
import {
  buildWindowsBootstrapScript,
  buildWindowsManualBootstrapCommand,
  createWindowsBootstrapToken,
  resolveInstallBaseUrl,
  verifyWindowsBootstrapToken,
} from "./windows-bootstrap-utils";

describe("windows-bootstrap-utils", () => {
  it("builds a one-line PowerShell install command", () => {
    expect(buildWindowsManualBootstrapCommand("https://example.com/install.ps1?token=abc")).toBe(
      'irm "https://example.com/install.ps1?token=abc" | iex',
    );
  });

  it("embeds required Windows bootstrap env vars and reconcile flow in script", () => {
    const script = buildWindowsBootstrapScript({
      hostname: "d1-1b583f.example.com",
      publicUrl: "https://d1-1b583f.example.com",
      instanceId: "72494de4-9863-4100-9254-e899dc1b583f",
      cloudflaredToken: "cloudflared-token-value",
      supabaseUrl: "https://esjlbgeolatmiesesait.supabase.co",
      supabaseAnonKey: "supabase-anon-key",
      supabaseServiceRoleKey: "supabase-service-role-key",
      gomtmBinaryUrls: [
        "https://unpkg.com/gomtm-win@latest/bin/gomtm.exe",
        "https://cdn.jsdelivr.net/npm/gomtm-win@latest/bin/gomtm.exe",
      ],
    });

    expect(script).toContain("$env:GOMTM_INSTANCE_ID = '72494de4-9863-4100-9254-e899dc1b583f'");
    expect(script).toContain("$env:SUPABASE_URL = 'https://esjlbgeolatmiesesait.supabase.co'");
    expect(script).toContain("$env:SUPABASE_ANON_KEY = 'supabase-anon-key'");
    expect(script).toContain("$env:SUPABASE_SERVICE_ROLE_KEY = 'supabase-service-role-key'");
    expect(script).toContain("$env:CLOUDFLARED_TOKEN = 'cloudflared-token-value'");
    expect(script).toContain("$env:GOMTM_LISTEN = '127.0.0.1:8383'");
    expect(script).toContain("gomtm.exe");
    expect(script).toContain("https://d1-1b583f.example.com/api/system/status");
    expect(script).toContain("/rest/v1/rpc/server_status_reconcile");
    expect(script).toContain(["$", "{url}: 下载结果为空"].join(""));
    expect(script).toContain(["$", "{url}: $($_.Exception.Message)"].join(""));
  });

  it("signs and verifies Windows bootstrap tokens", async () => {
    const token = await createWindowsBootstrapToken(
      {
        serverId: "72494de4-9863-4100-9254-e899dc1b583f",
        exp: Date.now() + 60_000,
      },
      "test-secret",
    );

    await expect(verifyWindowsBootstrapToken(token, "test-secret")).resolves.toEqual({
      serverId: "72494de4-9863-4100-9254-e899dc1b583f",
      exp: expect.any(Number),
    });
  });

  it("rejects expired Windows bootstrap tokens", async () => {
    const token = await createWindowsBootstrapToken(
      {
        serverId: "72494de4-9863-4100-9254-e899dc1b583f",
        exp: Date.now() - 1,
      },
      "test-secret",
    );

    await expect(verifyWindowsBootstrapToken(token, "test-secret")).rejects.toThrow("bootstrap token expired");
  });

  it("prefers configured public BASE_URL over localhost request origin", () => {
    expect(
      resolveInstallBaseUrl(
        "http://127.0.0.1:3700/api/cf/server/windows/manual-bootstrap",
        undefined,
        "https://gomtmui-dev.example.com",
      ),
    ).toBe("https://gomtmui-dev.example.com");
    expect(
      resolveInstallBaseUrl(
        "http://103.73.161.132:3700/api/cf/server/windows/manual-bootstrap",
        undefined,
        "https://gomtmui-dev.example.com",
      ),
    ).toBe("https://gomtmui-dev.example.com");
  });

  it("prefers public config site_url over env BASE_URL and request origin", () => {
    expect(
      resolveInstallBaseUrl(
        "http://127.0.0.1:3700/api/cf/server/windows/manual-bootstrap",
        "https://gomtmui-dev.example.com",
        "https://fallback.example.com",
      ),
    ).toBe("https://gomtmui-dev.example.com");
  });
});
