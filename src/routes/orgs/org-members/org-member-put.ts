import type { Context } from "hono";
import type { IHonoAppBinding } from "../../../types.js";
import {
  initializeConnection,
  ROLES,
  sendSuccessResponse,
  throwErrorInResponseIfErrorIsNotCustom,
} from "../../../utils/index.js";
import { appInfo } from "../../../config/app-config.js";
import { updateOrgMembersInOrg } from "./org-member-utils.js";

const editUsersInOrg = async (c: Context<IHonoAppBinding>) => {
  const body = await c.req.json();
  const user = c.get("user");

  const getReqData = (user: any) => ({
    org_user_is_active: true,
    org_user_role_id: ROLES.IS_VALID_ROLE_ID(user?.role_id)
      ? user?.role_id
      : ROLES.READ,
  });

  const formatResponse = (req: any) => ({
    role_id: "org_user_role_id" in req ? req.org_user_role_id : ROLES.READ,
  });

  const requestObj = {
    needToUpdateRecords: body.users,
    orgId: body.org_id,
    loggedInUserId: user?.id,
  };

  return await initializeConnection(async () => {
    try {
      const result = await updateOrgMembersInOrg(
        requestObj,
        getReqData,
        formatResponse,
        c,
      );
      return sendSuccessResponse(c, result);
    } catch (error: any) {
      return throwErrorInResponseIfErrorIsNotCustom(c, error, {
        errorMsg: `An error occurred while updating an ${appInfo.account_type_txt.singular.toLocaleLowerCase()}'s team members.`,
        solution:
          "Please try again later or contact support if the issue persists.",
      });
    }
  });
};

export { editUsersInOrg };
