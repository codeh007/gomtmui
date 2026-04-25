import { swaggerUI } from "@hono/swagger-ui";
import type { Hono } from "hono";
import { openAPIRouteHandler } from "hono-openapi";
import { ApiPrefix } from "../../context";
import { getServerBaseUrl } from "../../lib/sslib";
import type { AppContext } from "../../types";
export const configureOpenapiDoc = (app: Hono<AppContext>) => {
  app.get(`${ApiPrefix}/doc`, swaggerUI({ url: `${ApiPrefix}/openapi` }));
  app.get(
    `${ApiPrefix}/openapi`,
    openAPIRouteHandler(app, {
      documentation: {
        openapi: "3.0.0",
        info: {
          version: "1.0.0",
          title: "mtgate",
          description: "MtGate",
        },
        servers: [
          {
            url: `${getServerBaseUrl()}`,
            description: "base URL",
          },
        ],
        // security: [
        //   {
        //   },
        // ],
      },
    }),
  );
};
