import type { Context } from "hono";
import type { IHonoAppBinding } from "../../../types";
import {
  executeSql,
  getErrorResponseObj,
  getResponseObj,
  initializeConnection,
  sendErrorResponse,
  sendSuccessResponse,
  throwErrorInResponseIfErrorIsNotCustom,
} from "../../../utils";
import { checkWriteAccess } from "./org-member-utils";

const getOrgMembersByOrgId = (orgId: number, c: Context<IHonoAppBinding>) => {
  const sql = `SELECT
                u.user_id,
                ou.org_id,
                (ou.org_user_is_active AND u.user_is_active) AS is_active,
                ou.org_user_role_id as role_id,
                ou.user_opinion,
                u.user_email,
                u.user_fname,
                u.user_lname,
                ou.created_at as joined_on
              FROM auth_organization_users_tbl ou
              INNER JOIN auth_users_tbl u ON ou.user_id = u.user_id
              INNER JOIN auth_organization_tbl o ON ou.org_id = o.org_id
              WHERE o.org_id = ${orgId} AND o.org_is_deleted = 0;`;

  return executeSql(sql, c);
};

const getOrgMembers = async (c: Context<IHonoAppBinding>) => {
  const user = c.get("user");
  const loggedInUserId = user?.id;
  const orgId = Number(c.req.param("orgId"));

  return await initializeConnection(async () => {
    try {
      await checkWriteAccess(orgId, loggedInUserId, c);

      const orgMembers = (await getOrgMembersByOrgId(orgId, c)) as any[];

      const loggedInUserExists = orgMembers.some(
        (rec) => rec.user_id === loggedInUserId,
      );

      if (loggedInUserExists === false) {
        return sendErrorResponse(
          c,
          getErrorResponseObj({
            errorMsg: "You do not have any permissions to access it.",
            solution: "Access Denied! Contact your Org administrator.",
          }),
        );
      }

      const sqlUnregisteredUsers = `SELECT invited_users_id, email, invited_user_role_id as role_id, invited_by_user_id, updated_at FROM auth_invited_users_tbl 
                                    WHERE is_deleted = 0 AND org_id = ${orgId}`;

      const unregisteredUsers = await executeSql(sqlUnregisteredUsers, c);

      return sendSuccessResponse(
        c,
        getResponseObj({ orgMembers, unregisteredUsers }),
      );
    } catch (error: any) {
      return throwErrorInResponseIfErrorIsNotCustom(c, error, {
        errorMsg: "Encountered an error while fetching Team Member.",
        solution: "Error occurred while communicating with database.",
      });
    }
  });
};

export { getOrgMembers };
