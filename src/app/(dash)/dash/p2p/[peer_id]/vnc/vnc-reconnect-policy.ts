import { WorkerControlRequestError } from "@/lib/p2p/worker-control";

const RETRY_DELAYS_MS = [1200, 2500, 5000, 8000, 12000] as const;
const PERMISSION_DENIED_RE = /permission denied|forbidden|not allowed|拒绝访问|无权限/iu;
const WAITING_FOR_TARGET_RE =
  /VNC resource is not ready|VNC resource is not running|unknown resource_id|尚未准备好|还未完成 discovery|没有 browser-dialable endpoint|尚未暴露可供浏览器直连的 endpoint/iu;
const FATAL_RE =
  /unsupported|invalid invoke|invalid stream\.open|stale VNC lease|resource busy|not configured|bad frame/iu;

export type P2PVncReconnectDecision = {
  kind: "retry" | "wait_for_target" | "permission_denied" | "fatal";
  message: string;
};

function normalizeErrorMessage(error: unknown) {
  if (error instanceof Error) {
    return error.message.trim();
  }
  return String(error ?? "").trim();
}

function withFallbackMessage(message: string, fallbackMessage: string) {
  return message === "" ? fallbackMessage : message;
}

export function getP2PVncReconnectDelayMs(attempt: number) {
  const normalizedAttempt = Math.max(0, attempt);
  return RETRY_DELAYS_MS[Math.min(normalizedAttempt, RETRY_DELAYS_MS.length - 1)];
}

export function formatP2PVncReconnectDelay(delayMs: number) {
  const seconds = delayMs / 1000;
  return Number.isInteger(seconds) ? `${seconds} 秒` : `${seconds.toFixed(1)} 秒`;
}

export function classifyP2PVncConnectionError(error: unknown): P2PVncReconnectDecision {
  const message = normalizeErrorMessage(error);

  if (error instanceof WorkerControlRequestError) {
    const code = error.code?.trim().toUpperCase() ?? "";

    if (code.includes("PERMISSION_DENIED") || PERMISSION_DENIED_RE.test(message)) {
      return {
        kind: "permission_denied",
        message: withFallbackMessage(message, "目标节点拒绝了当前桌面会话权限。"),
      };
    }

    if (code === "SB_NOT_FOUND") {
      return {
        kind: "wait_for_target",
        message: withFallbackMessage(message, "目标设备尚未准备好桌面入口，出现后会自动进入桌面。"),
      };
    }

    if (error.retryable === true) {
      return {
        kind: "retry",
        message: withFallbackMessage(message, "桌面连接暂时失败，页面将自动重试。"),
      };
    }

    if (error.retryable === false) {
      return {
        kind: "fatal",
        message: withFallbackMessage(message, "目标桌面会话当前无法自动恢复。"),
      };
    }
  }

  if (PERMISSION_DENIED_RE.test(message)) {
    return {
      kind: "permission_denied",
      message: withFallbackMessage(message, "目标节点拒绝了当前桌面会话权限。"),
    };
  }

  if (WAITING_FOR_TARGET_RE.test(message)) {
    return {
      kind: "wait_for_target",
      message: withFallbackMessage(message, "目标设备尚未准备好桌面入口，出现后会自动进入桌面。"),
    };
  }

  if (FATAL_RE.test(message)) {
    return {
      kind: "fatal",
      message: withFallbackMessage(message, "目标桌面会话当前无法自动恢复。"),
    };
  }

  return {
    kind: "retry",
    message: withFallbackMessage(message, "桌面连接暂时失败，页面将自动重试。"),
  };
}
