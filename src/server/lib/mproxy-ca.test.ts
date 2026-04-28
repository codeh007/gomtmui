import { describe, expect, it } from "vitest";
import { buildMproxyCaDownloadUrl } from "@/components/mproxy/schemas";
import { generateMproxyCA } from "./mproxy-ca";

describe("generateMproxyCA", () => {
  it("returns PEM material and metadata for the environment CA", async () => {
    const result = await generateMproxyCA();

    expect(result.certPem).toContain("BEGIN CERTIFICATE");
    expect(result.privateKeyPem).toContain("BEGIN RSA PRIVATE KEY");
    expect(result.subjectCommonName).toBe("Gomtm MITM Proxy CA");
    expect(result.sha256Fingerprint).toMatch(/^[a-f0-9]{64}$/);
  });

  it("builds the CA download URL from gomtm server origin and download path", () => {
    expect(buildMproxyCaDownloadUrl("https://gomtm.example:8443/base/", "/api/mproxy/mitm/ca.crt")).toBe(
      "https://gomtm.example:8443/api/mproxy/mitm/ca.crt",
    );
  });

  it("returns null when gomtm server origin is empty", () => {
    expect(buildMproxyCaDownloadUrl("", "/api/mproxy/mitm/ca.crt")).toBeNull();
  });
});
