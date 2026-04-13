export const SCRCPY_SERVER_VERSION = "3.3.3";
export const SCRCPY_SERVER_PROXY_PATH = "/api/android/scrcpy-server";

const SCRCPY_VERSION_PATTERN = /^\d+\.\d+\.\d+$/;

export function resolveScrcpyServerAssetURL(version = SCRCPY_SERVER_VERSION) {
  return `${SCRCPY_SERVER_PROXY_PATH}?v=${encodeURIComponent(version)}`;
}

export function resolveUpstreamScrcpyServerURL(version = SCRCPY_SERVER_VERSION) {
  const normalizedVersion = version.trim();
  if (!SCRCPY_VERSION_PATTERN.test(normalizedVersion)) {
    throw new Error(`invalid scrcpy server version: ${version}`);
  }
  return `https://github.com/Genymobile/scrcpy/releases/download/v${normalizedVersion}/scrcpy-server-v${normalizedVersion}`;
}
