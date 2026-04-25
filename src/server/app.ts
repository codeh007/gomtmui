import { Hono } from "hono";
import { contextStorage } from "hono/context-storage";
import { ApiPrefix, isDebug } from "./context";
import { createInternalError } from "./lib/api_schema";
import { configuredCorsMiddleware } from "./middlewares/corsMiddleware";
import { cloudAccountRoute } from "./routes/cloud-account";
import { cloudflareRoute } from "./routes/cloudflare";
import { configureOpenapiDoc } from "./routes/doc";
import { githubRoute } from "./routes/github";
import { netProxyRoute } from "./routes/net-proxy";
import openaiV1Route from "./routes/openai_v1";
import { serverRoute } from "./routes/server";
import type { AppContext } from "./types";

const app = new Hono<AppContext>();
app.use(contextStorage());
app.use("*", async (c, next) => {
  console.log(`[mtgate] incoming request: ${c.req.method} ${c.req.path}`);
  await next();
});
configureOpenapiDoc(app);
app.use("*", configuredCorsMiddleware());
app.route(ApiPrefix, openaiV1Route);
app.route(ApiPrefix, netProxyRoute);
app.route(ApiPrefix, cloudflareRoute);
app.route(ApiPrefix, githubRoute);
app.route(ApiPrefix, serverRoute);

app.route(ApiPrefix, cloudAccountRoute);

app.onError((err, c) => {
  const errorResponse = createInternalError(err.message);
  console.log(`app on error,path:${c.req.path}`, err);
  if (isDebug()) {
    errorResponse.error.details = err.stack;
  }
  return c.json(errorResponse, 500);
});

export { app };
export default app;
