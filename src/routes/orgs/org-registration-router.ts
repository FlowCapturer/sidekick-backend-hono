import { Hono } from "hono";
import { IHonoAppBinding } from "../../types.js";
import { deleteOrg } from "./org-delete.js";
import { getAllowedOrgs } from "./org-get.js";
import { postOrgs } from "./org-post.js";
import { putOrgs } from "./org-put.js";

const orgRegistrationRouter = new Hono<IHonoAppBinding>();

orgRegistrationRouter.get("/", getAllowedOrgs);
orgRegistrationRouter.post("/", postOrgs);
orgRegistrationRouter.delete("/:id", deleteOrg);
orgRegistrationRouter.put("/:id", putOrgs);

export default orgRegistrationRouter;
