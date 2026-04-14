const browserNodeInstanceKeys = new WeakMap<object, number>();
let browserNodeInstanceSeq = 0;

export type NativeCanvasPoint = {
  x: number;
  y: number;
};

export function getBrowserNodeInstanceKey(node: unknown) {
  if (node == null) {
    return "none";
  }
  if (typeof node !== "object" && typeof node !== "function") {
    return String(node);
  }

  const objectNode = node as object;
  const existingKey = browserNodeInstanceKeys.get(objectNode);
  if (existingKey != null) {
    return `node-${existingKey}`;
  }

  browserNodeInstanceSeq += 1;
  browserNodeInstanceKeys.set(objectNode, browserNodeInstanceSeq);
  return `node-${browserNodeInstanceSeq}`;
}

export function projectCanvasPoint(params: {
  canvas: HTMLCanvasElement;
  clientX: number;
  clientY: number;
  videoHeight: number;
  videoWidth: number;
}): NativeCanvasPoint | null {
  const rect = params.canvas.getBoundingClientRect();
  if (rect.width <= 0 || rect.height <= 0) {
    return null;
  }

  return {
    x: Math.round(((params.clientX - rect.left) / rect.width) * params.videoWidth),
    y: Math.round(((params.clientY - rect.top) / rect.height) * params.videoHeight),
  };
}

function inferScreenshotExtension(mimeType: string) {
  if (mimeType.includes("jpeg")) {
    return "jpg";
  }
  if (mimeType.includes("webp")) {
    return "webp";
  }
  return "png";
}

export function triggerScreenshotDownload(params: { imageBase64: string; mimeType: string; peerId: string }) {
  const binary = atob(params.imageBase64);
  const bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0));
  const blob = new Blob([bytes], { type: params.mimeType });
  const objectUrl = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = objectUrl;
  anchor.download = `android-${params.peerId}-${Date.now()}.${inferScreenshotExtension(params.mimeType)}`;
  anchor.click();
  URL.revokeObjectURL(objectUrl);
}

export function isScreenCapturePermissionError(error: unknown) {
  if (error instanceof Error && "code" in error) {
    const code =
      typeof (error as { code?: unknown }).code === "string" ? (error as { code?: string }).code?.trim() : "";
    if (code === "SB_PERMISSION_REQUIRED") {
      return true;
    }
  }
  const message = error instanceof Error ? error.message.trim().toLowerCase() : String(error).trim().toLowerCase();
  return message.includes("screen capture permission is not granted");
}
