import type { MiddlewareHandler } from "hono";

/**
 * 简化的CORS中间件实现
 * 不考虑安全性，尽量放宽限制
 * 解决credentials模式下的跨域问题
 */
export const corsMiddleware = (): MiddlewareHandler => {
  return async function cors(c, next) {
    const requestOrigin = c.req.header("origin") || "";

    // 设置CORS头
    if (requestOrigin) {
      // 当有origin时，直接返回该origin（支持credentials）
      c.res.headers.set("Access-Control-Allow-Origin", requestOrigin);
    } else {
      // 没有origin时使用通配符
      c.res.headers.set("Access-Control-Allow-Origin", "*");
    }

    c.res.headers.set("Access-Control-Allow-Credentials", "true");
    c.res.headers.set("Access-Control-Allow-Methods", "GET, HEAD, PUT, POST, DELETE, PATCH, OPTIONS");
    c.res.headers.set(
      "Access-Control-Allow-Headers",
      "Origin, X-Requested-With, Content-Type, Accept, Authorization, X-Forwarded-For, User-Agent, Referer",
    );
    c.res.headers.set("Access-Control-Expose-Headers", "*");
    c.res.headers.set("Access-Control-Max-Age", "86400");
    c.res.headers.set("Vary", "Origin");

    // 处理预检请求
    if (c.req.method === "OPTIONS") {
      return new Response(null, {
        headers: c.res.headers,
        status: 204,
        statusText: "No Content",
      });
    }

    return await next();
  };
};

// 导出配置好的CORS中间件实例
export const configuredCorsMiddleware = corsMiddleware;
