import { Hono } from "hono";
import type { AppContext } from "../../types";

export const serverRoute = new Hono<AppContext>();
