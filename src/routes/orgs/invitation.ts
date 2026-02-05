import { Context, Hono } from "hono";
import { appInfo } from "../../app-config.js";
import { IHonoAppBinding } from "../../types.js";
import { isValidId } from "../../utils/common-utils.js";
import { INVITATION_ENUMS } from "../../utils/enums.js";
import {
  getErrorResponseObj,
  getResponseObj,
  sendSuccessResponse,
  throwErrorInResponseIfErrorIsNotCustom,
} from "../../utils/response-utils.js";
import {
  executeSql,
  initializeConnection,
  updateRecords,
} from "../../utils/sql-helper.js";
import { IInvitationRequest } from "../../utils/type.js";
import { getOrgCreatedBy, invalidateOrgUserCacheForUser } from "./org-utils.js";

const invitationRouter = new Hono<IHonoAppBinding>();

//here, these routes means, user is registered amd they can approve/deny the invitation.

invitationRouter.get("/", async (c: Context<IHonoAppBinding>) => {
  const user = c.get("user");
  const loggedInUserId = user?.id;

  return await initializeConnection(async () => {
    try {
      if (!isValidId(loggedInUserId)) {
        throw getErrorResponseObj({
          errorMsg: "Cannot retrieve invitations, invalid logged-in user.",
          solution: "Please re-login and try again.",
        });
      }

      const sql = `SELECT o.org_name, o.org_id, ou.org_user_role_id as role_id, ou.org_user_is_active, ou.updated_at as sent_at
                   FROM auth_organization_users_tbl ou INNER JOIN auth_organization_tbl o ON ou.org_id = o.org_id 
                   WHERE ou.user_id = ${loggedInUserId} AND ou.user_opinion = ${INVITATION_ENUMS.INVITED} AND ou.org_user_is_active = 1`;

      const invites = await executeSql(sql, c);

      return sendSuccessResponse(c, getResponseObj({ invites }));
    } catch (error: any) {
      return throwErrorInResponseIfErrorIsNotCustom(c, error, {
        errorMsg: "Error occurred while adding retrieving invitations.",
        solution:
          "Please try again later or contact support if the issue persists.",
      });
    }
  });
});

invitationRouter.put("/", async (c: Context<IHonoAppBinding>) => {
  /**
   * You can use this API to ACCEPT, REJECT or LEFT any org.
   * Req JSON: {
   *   org_id: number,
   *   user_opinion: type of INVITATION_ENUMS
   * }
   */

  const user = c.get("user");
  const loggedInUserId = user?.id;
  const body = (await c.req.json()) as IInvitationRequest;
  const { org_id, user_opinion } = body;

  const userOpinion = parseInt(String(user_opinion), 10);
  const isAccept = userOpinion === INVITATION_ENUMS.ACCEPTED;

  return await initializeConnection(async () => {
    try {
      if (!isValidId(loggedInUserId)) {
        throw getErrorResponseObj({
          errorMsg: `Cannot ${isAccept ? "accept" : "reject"} the invitation, invalid logged-in user.`,
          solution: "Please re-login and try again.",
        });
      } else if (!isValidId(org_id)) {
        throw getErrorResponseObj({
          errorMsg: `Cannot ${isAccept ? "accept" : "reject"} the invitation, invalid ${appInfo.account_type_txt.singular.toLocaleLowerCase()} details user.`,
          solution: "org_id is missing in request json.",
        });
      } else if (
        userOpinion !== INVITATION_ENUMS.ACCEPTED &&
        userOpinion !== INVITATION_ENUMS.REJECTED &&
        userOpinion !== INVITATION_ENUMS.LEFT
      ) {
        throw getErrorResponseObj({
          errorMsg: `Invalid option selected please either select approve or reject or left to continue.`,
          solution: "org_id is missing in request json.",
        });
      }

      if (!isAccept) {
        const orgCreatedBy = await getOrgCreatedBy(org_id, c);
        if (orgCreatedBy === loggedInUserId) {
          throw getErrorResponseObj({
            errorMsg: `As you are the creator of this ${appInfo.account_type_txt.singular.toLocaleLowerCase()}, you cannot leave this ${appInfo.account_type_txt.singular.toLocaleLowerCase()}.`,
            solution: `If you want to delete this ${appInfo.account_type_txt.singular.toLocaleLowerCase()}, please use the delete option instead.`,
          });
        }
      }

      const updateData = {
        user_opinion: userOpinion,
      };

      const whereClause = {
        org_id,
        user_id: loggedInUserId,
      };

      const responseObj: any = await updateRecords(
        "auth_organization_users_tbl",
        updateData,
        whereClause,
        c,
      );
      const success = responseObj.changes > 0;
      await invalidateOrgUserCacheForUser(
        whereClause.org_id,
        whereClause.user_id,
      );

      if (success) {
        return sendSuccessResponse(
          c,
          getResponseObj({ ...updateData, ...whereClause }),
        );
      }

      throw getErrorResponseObj({
        errorMsg: `Error occurred while ${isAccept ? "accepting" : "rejecting"} an invitation.`,
        solution:
          "Please try again later or contact support if the issue persists.",
      });
    } catch (error: any) {
      return throwErrorInResponseIfErrorIsNotCustom(c, error, {
        errorMsg: `Error occurred while ${isAccept ? "accepting" : "rejecting"} an invitation.`,
        solution:
          "Please try again later or contact support if the issue persists.",
      });
    }
  });
});

export default invitationRouter;
