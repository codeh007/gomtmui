import { Hono } from "hono";
import type { AppContext } from "../../types";
import { oauthCallbackRoute } from "./oauth-callback";
import { tokenRefreshRoute } from "./token-refresh";

export const cloudAccountRoute = new Hono<AppContext>();
cloudAccountRoute.route("/cloud-account", tokenRefreshRoute);
cloudAccountRoute.route("/cloud-account", oauthCallbackRoute);
