import type { Context } from "hono";
import type { IHonoAppBinding } from "../../../types.js";
import {
  initializeConnection,
  INVITATION_ENUMS,
  ROLES,
  sendSuccessResponse,
  throwErrorInResponseIfErrorIsNotCustom,
} from "../../../utils/index.js";
import { getOrgCreatedBy } from "../org-utils.js";
import { updateOrgMembersInOrg } from "./org-member-utils.js";
import { appInfo } from "../../../config/app-config.js";

const deleteUsersInOrg = async (c: Context<IHonoAppBinding>) => {
  const body = await c.req.json();
  const user = c.get("user");

  return await initializeConnection(async () => {
    try {
      const requestObj = {
        needToUpdateRecords: body.users,
        orgId: body.org_id,
        loggedInUserId: parseInt(user?.id, 10),
      };

      const orgCreatedBy = (await getOrgCreatedBy(
        requestObj.orgId,
        c,
      )) as number;
      const getReqData = (user: any) => {
        if (user?.user_id === orgCreatedBy) {
          //Not allowing to delete the org created by own user
          return false;
        }

        return {
          org_user_is_active: false,
          user_opinion: INVITATION_ENUMS.INVITED,
        };
      };

      const formatResponse = () => ({
        role_id: ROLES.READ,
        deleted: true,
      });

      const result = await updateOrgMembersInOrg(
        requestObj,
        getReqData,
        formatResponse,
        c,
      );
      return sendSuccessResponse(c, result);
    } catch (error: any) {
      return throwErrorInResponseIfErrorIsNotCustom(c, error, {
        errorMsg: `An error occurred while deleting an ${appInfo.account_type_txt.singular.toLocaleLowerCase()}'s team members.`,
        solution:
          "Please try again later or contact support if the issue persists.",
      });
    }
  });
};

export { deleteUsersInOrg };
