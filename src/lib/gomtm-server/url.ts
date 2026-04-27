export const GOMTM_DASH_SERVER_URL_STORAGE_KEY = "gomtm:dash:server-url";

function parseHttpGomtmServerUrl(value: string) {
  if (!value) {
    return null;
  }

  try {
    const url = new URL(value);
    if (url.protocol !== "http:" && url.protocol !== "https:") {
      return null;
    }

    return url;
  } catch {
    return null;
  }
}

export function normalizeGomtmServerUrl(value: string) {
  const trimmedValue = value.trim();
  const url = parseHttpGomtmServerUrl(trimmedValue);
  return url ? url.origin : trimmedValue.replace(/\/+$/, "");
}

export function isValidGomtmServerUrl(value: string) {
  const trimmedValue = value.trim();
  const url = parseHttpGomtmServerUrl(trimmedValue);
  return url != null && trimmedValue === url.origin;
}

export function getGomtmServerHost(value: string) {
  try {
    return new URL(value).host;
  } catch {
    return value;
  }
}
