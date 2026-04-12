import { isServer, MutationCache, QueryCache, QueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

function makeQueryClient() {
  const handleRpcError = (error: unknown) => {
    // 捕获规范化的 RPC 错误码 (以 P 开头)
    const pgErr = error as any;

    // 1. 网络离线或服务端完全失联 (如 502 Bad Gateway)
    if (
      pgErr instanceof TypeError &&
      (pgErr.message === "Failed to fetch" || pgErr.message === "NetworkError when attempting to fetch resource.")
    ) {
      toast.error("网络连接失败", {
        description: "无法连接到服务器，请检查您的网络连接或稍后重试。",
      });
      return;
    }

    // 2. 捕获 HTTP 级别严重状态码 (502, 503, 504)
    if (pgErr?.status && pgErr.status >= 500) {
      toast.error("服务暂时不可用", {
        description: pgErr.message || `抱歉，服务端遇到异常 (错误状态: ${pgErr.status})`,
      });
      return;
    }

    // 3. 业务层级的权限降级 (HTTP 401/403)
    if (pgErr?.status === 401 || pgErr?.status === 403) {
      toast.error("访问被拒绝", {
        description: pgErr.message || "您没有权限执行此操作，或您的登录已过期。",
      });
      return;
    }

    // 4. 标准 RPC 或数据库层错误
    if (typeof pgErr?.code === "string" && pgErr.code.startsWith("P")) {
      let title = "操作失败";

      switch (pgErr.code) {
        case "P4010":
          title = "未登录或登录已过期";
          break;
        case "P4030":
          title = "权限不足";
          break;
        case "P4040":
        case "P0002":
          title = "资源不存在";
          break;
        case "P4000":
        case "P4220":
          title = "请求参数错误";
          break;
        case "P0001":
          title = "业务处理异常";
          break;
        default:
          title = "操作失败";
          break;
      }

      toast.error(title, {
        description: pgErr.message || `错误代码: ${pgErr.code}`,
      });
    } else if (pgErr instanceof Error && !(pgErr as any).code) {
      // 5. 兜底其它未知错误对象
      // toast.error("操作遇到异常", { description: pgErr.message });
    }
  };

  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 5 * 60 * 1000,
        gcTime: 30 * 60 * 1000,
        retryDelay: 500,
      },
    },
    mutationCache: new MutationCache({
      onError: handleRpcError,
    }),
    queryCache: new QueryCache({
      onError: handleRpcError,
    }),
  });
}

let browserQueryClient: QueryClient | undefined;

export function getQueryClient() {
  if (isServer) {
    return makeQueryClient();
  }
  if (!browserQueryClient) browserQueryClient = makeQueryClient();

  return browserQueryClient;
}
