import { Hono } from "hono";
import type { AppContext } from "../../../types";
import { windowsBootstrapRoute } from "./windows-bootstrap";

export const serverRoute = new Hono<AppContext>();

serverRoute.route("/server/windows", windowsBootstrapRoute);
