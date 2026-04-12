import { Hono } from "hono";
import type { AppContext } from "../../../types";
import { tunnelCleanupRoute as tunnelCleanup } from "./tunnel-cleanup";
import { tunnelSetupRoute } from "./tunnel-setup";

export const cloudflareRoute = new Hono<AppContext>();
cloudflareRoute.route("/tunnel", tunnelSetupRoute);
cloudflareRoute.route("/tunnel", tunnelCleanup);
