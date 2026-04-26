export interface AndroidHostInfo {
  hostKind: string;
  packageName?: string;
  appVersion?: string;
  dashP2pUrl?: string;
}

export interface AndroidActivationSurface {
  available: boolean;
  activationStatus: "inactive" | "activating" | "active" | "unknown";
  hostActionState?: string;
  serviceActivationRequested?: boolean;
  canRequestScreenCapture: boolean;
  canStartDeviceService?: boolean;
}

export interface AndroidHostBridgeApi {
  getHostInfo?: () => string;
  getActivationSurface?: () => string;
  startDeviceService?: () => string;
  requestScreenCapture?: () => string;
}

declare global {
  interface Window {
    GomtmHostBridge?: AndroidHostBridgeApi;
  }
}

function parseJson<T>(raw: string | undefined, fallback: T): T {
  if (!raw) {
    return fallback;
  }

  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

export function getAndroidHostBridge(): AndroidHostBridgeApi | null {
  if (typeof window === "undefined") {
    return null;
  }

  return window.GomtmHostBridge ?? null;
}

export function isAndroidHostEnvironment(): boolean {
  return getAndroidHostBridge() !== null;
}

export function readAndroidHostInfo(): AndroidHostInfo | null {
  const bridge = getAndroidHostBridge();
  if (!bridge?.getHostInfo) {
    return null;
  }

  return parseJson<AndroidHostInfo | null>(bridge.getHostInfo(), null);
}

export function readAndroidActivationSurface(): AndroidActivationSurface | null {
  const bridge = getAndroidHostBridge();
  if (!bridge?.getActivationSurface) {
    return null;
  }

  return parseJson<AndroidActivationSurface>(
    bridge.getActivationSurface(),
    {
      available: false,
      activationStatus: "unknown",
      hostActionState: "unknown",
      serviceActivationRequested: false,
      canRequestScreenCapture: false,
      canStartDeviceService: false,
    },
  );
}

export function requestAndroidDeviceServiceStart(): boolean {
  const bridge = getAndroidHostBridge();
  if (!bridge?.startDeviceService) {
    return false;
  }

  parseJson<{ accepted?: boolean }>(bridge.startDeviceService(), { accepted: false });
  return true;
}
