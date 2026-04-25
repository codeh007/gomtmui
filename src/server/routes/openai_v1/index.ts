import { Hono } from "hono";
import type { AppContext } from "../../types";
import { chatCompletionsRoute } from "./chat/completions";

const openaiRoute = new Hono<AppContext>();
openaiRoute.route("/modelapi", chatCompletionsRoute);

export { openaiRoute };
export default openaiRoute;
