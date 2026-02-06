import { Hono } from "hono";
import { IHonoAppBinding } from "../../types.js";
import invitationRouter from "./invitation.js";
import orgMembersRouter from "./org-members/org-members.js";
import orgRegistrationRouter from "./org-registration-router.js";

export {
  getOrgUserRecord,
  getOrgCreatedBy,
  isOrgUserActive,
} from "./org-utils.js";

const orgsRouter = new Hono<IHonoAppBinding>();

orgsRouter.route("/", orgRegistrationRouter);
orgsRouter.route("/members", orgMembersRouter);
orgsRouter.route("/invitation", invitationRouter);

export default orgsRouter;
