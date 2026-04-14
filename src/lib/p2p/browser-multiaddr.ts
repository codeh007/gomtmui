export function normalizeBrowserMultiaddr(value: string) {
  const trimmed = value.trim();

  if (trimmed === "" || !trimmed.includes("/webtransport") || !trimmed.includes("/certhash/")) {
    return trimmed;
  }

  const segments = trimmed.split("/");
  const normalized: string[] = [];
  let seenCertHash = false;

  for (let index = 0; index < segments.length; index += 1) {
    const segment = segments[index];
    if (segment !== "certhash") {
      normalized.push(segment);
      continue;
    }

    const hashValue = segments[index + 1];
    if (hashValue == null) {
      break;
    }

    if (!seenCertHash) {
      normalized.push(segment, hashValue);
      seenCertHash = true;
    }

    index += 1;
  }

  return normalized.join("/");
}

export function sameBrowserMultiaddr(left: string, right: string) {
  return normalizeBrowserMultiaddr(left) === normalizeBrowserMultiaddr(right);
}
