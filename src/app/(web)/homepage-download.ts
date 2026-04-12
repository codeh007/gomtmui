import { readFileSync } from "node:fs";
import path from "node:path";

const HOMEPAGE_ANDROID_HOST_ARTIFACT = "gomtm-mt-latest";

export const HOMEPAGE_APK_PATH = `/downloads/${HOMEPAGE_ANDROID_HOST_ARTIFACT}.apk`;

export interface HomepageDownloadMeta {
  fileName: string;
  version: string;
  updatedAt: string;
  size: number;
  abi?: string;
  sourceArtifact?: string;
}

const LOCAL_HOSTS = new Set(["localhost", "127.0.0.1", "0.0.0.0", "::1"]);
const HOMEPAGE_DOWNLOAD_META_JSON_PATH = path.resolve(
  process.cwd(),
  `public/downloads/${HOMEPAGE_ANDROID_HOST_ARTIFACT}.json`,
);

export function loadHomepageDownloadMeta(): HomepageDownloadMeta | null {
  try {
    return JSON.parse(readFileSync(HOMEPAGE_DOWNLOAD_META_JSON_PATH, "utf8")) as HomepageDownloadMeta;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      return null;
    }

    throw error;
  }
}

export function resolveHomepageDownloadQrUrl(publicBaseUrl?: string | null): string | null {
  const configuredBaseUrl =
    publicBaseUrl ??
    process.env.NEXT_PUBLIC_SITE_URL ??
    process.env.NEXT_PUBLIC_BASE_URL ??
    process.env.BASE_URL ??
    (process.env.CODESPACE_NAME
      ? `https://${process.env.CODESPACE_NAME}-${process.env.PORT || 3700}.app.github.dev`
      : null);

  if (!configuredBaseUrl) {
    return null;
  }

  try {
    const origin = new URL(configuredBaseUrl);

    if (!origin.protocol.startsWith("http") || LOCAL_HOSTS.has(origin.hostname)) {
      return null;
    }

    return new URL(HOMEPAGE_APK_PATH, origin).toString();
  } catch {
    return null;
  }
}
