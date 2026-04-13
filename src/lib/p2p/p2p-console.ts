type P2PConsoleLevel = "info" | "warn" | "error" | "debug";

const P2P_VERBOSE_STORAGE_KEY = "gomtm:p2p:verbose-console";

function resolveConsoleMethod(level: P2PConsoleLevel) {
  switch (level) {
    case "error":
      return console.error;
    case "warn":
      return console.warn;
    case "debug":
      return console.debug;
    default:
      return console.log;
  }
}

export function isVerboseP2PConsoleEnabled() {
  if (typeof window === "undefined") {
    return false;
  }

  try {
    return window.localStorage.getItem(P2P_VERBOSE_STORAGE_KEY) === "1";
  } catch {
    return false;
  }
}

export function logP2PConsole(
  level: P2PConsoleLevel,
  message: string,
  details?: unknown,
  options?: { verboseOnly?: boolean },
) {
  if (options?.verboseOnly === true && !isVerboseP2PConsoleEnabled()) {
    return;
  }

  const method = resolveConsoleMethod(level);
  if (details === undefined) {
    method(`[P2P] ${message}`);
    return;
  }
  method(`[P2P] ${message}`, details);
}

export function summarizePeerCandidates(
  candidates: Array<{
    peerId: string;
    multiaddrs: string[];
  }>,
) {
  return {
    count: candidates.length,
    peers: candidates.map((candidate) => ({
      multiaddrCount: candidate.multiaddrs.length,
      peerId: candidate.peerId,
    })),
  };
}
