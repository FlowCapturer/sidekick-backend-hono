import routes from "./routes/index.js";
import { Hono } from "hono";
import { IHonoAppBinding } from "./types.js";
import { cors } from "hono/cors";

export const honoApp = new Hono<IHonoAppBinding>();
honoApp.use(cors());
honoApp.route("/", routes);

export default honoApp;
