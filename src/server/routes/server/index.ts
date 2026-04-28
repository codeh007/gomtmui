import { Hono } from "hono";
import { gomtmConfigsRoute } from "../gomtm-configs";
import type { AppContext } from "../../types";

export const serverRoute = new Hono<AppContext>();

serverRoute.route("/gomtm", gomtmConfigsRoute);
