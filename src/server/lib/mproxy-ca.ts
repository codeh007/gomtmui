import { createHash } from "node:crypto";
import forge from "node-forge";

const MPROXY_CA_COMMON_NAME = "Gomtm MITM Proxy CA";
const MPROXY_CA_ORGANIZATION = "Gomtm";
const MPROXY_CA_VALIDITY_MS = 10 * 365 * 24 * 60 * 60 * 1000;
const MPROXY_CA_CLOCK_SKEW_MS = 60 * 60 * 1000;

export async function generateMproxyCA() {
  const keys = forge.pki.rsa.generateKeyPair({ bits: 2048, e: 0x10001 });
  const now = Date.now();
  const notBefore = new Date(now - MPROXY_CA_CLOCK_SKEW_MS);
  const notAfter = new Date(now + MPROXY_CA_VALIDITY_MS);

  const cert = forge.pki.createCertificate();
  cert.publicKey = keys.publicKey;
  cert.serialNumber = createHash("sha256")
    .update(`${now}-${Math.random()}`)
    .digest("hex")
    .slice(0, 32);
  cert.validity.notBefore = notBefore;
  cert.validity.notAfter = notAfter;

  const subject = [
    { name: "commonName", value: MPROXY_CA_COMMON_NAME },
    { name: "organizationName", value: MPROXY_CA_ORGANIZATION },
  ];

  cert.setSubject(subject);
  cert.setIssuer(subject);
  cert.setExtensions([
    { name: "basicConstraints", cA: true },
    { name: "keyUsage", cRLSign: true, digitalSignature: true, keyCertSign: true },
    { name: "subjectKeyIdentifier" },
  ]);
  cert.sign(keys.privateKey, forge.md.sha256.create());

  const certDer = forge.asn1.toDer(forge.pki.certificateToAsn1(cert)).getBytes();

  return {
    certPem: forge.pki.certificateToPem(cert),
    notAfter: notAfter.toISOString(),
    notBefore: notBefore.toISOString(),
    privateKeyPem: forge.pki.privateKeyToPem(keys.privateKey),
    sha256Fingerprint: createHash("sha256").update(Buffer.from(certDer, "binary")).digest("hex"),
    subjectCommonName: MPROXY_CA_COMMON_NAME,
  };
}
