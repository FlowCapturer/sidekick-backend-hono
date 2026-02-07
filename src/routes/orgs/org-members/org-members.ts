import { Hono } from "hono";
import { IHonoAppBinding } from "../../../types.js";

import { getOrgMembers } from "./org-member-get.js";
import { addUsersByEmail } from "./org-member-post.js";
import { editUsersInOrg } from "./org-member-put.js";
import { deleteUsersInOrg } from "./org-member-delete.js";
import { deleteUnregisteredUserInvitation } from "./org-member-delete-unregistered.js";

// const addUsersInOrg = async (c: Context<IHonoAppBinding>) => {
//   const reqBody = (await c.req.json()) || {};
//   const user = c.get("user");
//   return await initializeConnection(async () => {
//     try {
//       const result = await includeUsersInOrg(reqBody, user?.id, c, true);
//       await checkCanAllowToIncludeUsersInOrg(
//         reqBody.org_id,
//         registeredUsers.length + unRegisteredUsers.length,
//         c,
//       );
//       return sendSuccessResponse(c, getResponseObj(result));
//     } catch (error: any) {
//       return throwErrorInResponseIfErrorIsNotCustom(c, error, {
//         errorMsg: `An error occurred while adding new team member in ${appInfo.account_type_txt.singular}.`,
//         solution:
//           "Please try again later or contact support if the issue persists.",
//       });
//     }
//   });
// };
// orgMembersRouter.post("/", addUsersInOrg);

const orgMembersRouter = new Hono<IHonoAppBinding>();

orgMembersRouter.post("/by-emails", addUsersByEmail);
orgMembersRouter.get("/:orgId", getOrgMembers);
orgMembersRouter.put("/", editUsersInOrg);
orgMembersRouter.delete("/", deleteUsersInOrg);
orgMembersRouter.delete(
  "/unregistered-user-invitation",
  deleteUnregisteredUserInvitation,
);

export default orgMembersRouter;
