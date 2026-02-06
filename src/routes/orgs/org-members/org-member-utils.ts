import type { Context } from "hono";
import type { IHonoAppBinding } from "../../../types";
import { canWriteOrg, invalidateOrgUserCacheForUser } from "../org-utils";
import {
  executeSql,
  getErrorResponseObj,
  getRequestFromRoute,
  getResponseObj,
  insertRecords,
  INVITATION_ENUMS,
  IOrgMemberIsActiveSql,
  IOrgMemberIsAdminSql,
  IOrgMemberUpdateReq,
  isValidId,
  ROLES,
  throwErrorInResponseIfErrorIsNotCustom,
  updateRecords,
} from "../../../utils";
import { appInfo } from "../../../config/app-config";

export const checkWriteAccess = async (
  orgId: number,
  userId: number,
  c: Context<IHonoAppBinding>,
) => {
  // permission checks
  if ((await canWriteOrg(userId, orgId, c)) === false) {
    throw getErrorResponseObj({
      errorMsg: "You don't have permission to access it.",
      solution: `Contact your ${appInfo.account_type_txt.singular} administrator.`,
    });
  }
};

type GetReqDataFn = (
  user: any,
) => IOrgMemberIsAdminSql | IOrgMemberIsActiveSql | false;
type FormatResponseFn = (
  req: IOrgMemberIsAdminSql | IOrgMemberIsActiveSql,
) => any;

export const updateOrgMembersInOrg = async (
  requestObj: IOrgMemberUpdateReq,
  getReqData: GetReqDataFn,
  formatResponse: FormatResponseFn,
  c: Context<IHonoAppBinding>,
) => {
  const { users, orgId, loggedInUserId } = requestObj;

  if (!Array.isArray(users) || !isValidId(orgId) || users.length <= 0) {
    throw getErrorResponseObj({
      errorMsg: `Invalid user IDs or ${appInfo.account_type_txt.singular} ID.`,
      solution: `Please provide a valid list of user IDs and ${appInfo.account_type_txt.singular} ID.`,
    });
  }

  if (!isValidId(loggedInUserId)) {
    throw getErrorResponseObj({
      errorMsg: "Invalid logged-in user.",
      solution: "Please login again and try again.",
    });
  }

  try {
    // permission checks
    await checkWriteAccess(orgId, loggedInUserId, c);

    const result = [];
    let someFailed = false;

    for (const user of users) {
      const whereClause = {
        user_id: user.user_id,
        org_id: orgId,
      };

      const needToSETData = getReqData(user);

      try {
        if (needToSETData === false) {
          throw {
            errorMsg: `Cannot update the team member details as you are the creator of this ${appInfo.account_type_txt.singular.toLocaleLowerCase()}.`,
            solution: `If you want to delete this ${appInfo.account_type_txt.singular.toLocaleLowerCase()}, please use the delete option instead.`,
          };
        }

        const responseObj: any = await updateRecords(
          "auth_organization_users_tbl",
          needToSETData,
          whereClause,
          c,
        );
        const success = responseObj.changes > 0;
        await invalidateOrgUserCacheForUser(
          whereClause.org_id,
          whereClause.user_id,
        );

        result.push({
          success,
          changedFor: whereClause,
          updatedData: success ? formatResponse(needToSETData) : {},
        });
      } catch (error: any) {
        someFailed = true;
        result.push({
          success: false,
          changedFor: whereClause,
          error,
        });
      }
    }

    return getResponseObj({
      message: someFailed
        ? "Some team member's data haven't updated due to some issues."
        : "Team member's data has been updated successfully.",
      result,
      someFailed,
    });
  } catch (error: any) {
    throw error;
  }
};

export const includeUsersInOrg = async (
  requestObj: Record<string, unknown>,
  loggedInUserId: number,
  c: Context<IHonoAppBinding>,
  addPermissionCheck: boolean = true,
) => {
  const fields: Array<string> = ["included_users", "org_id"];
  const reqBody = getRequestFromRoute(requestObj, fields);
  const { included_users: users, org_id: orgId } = reqBody;

  try {
    if (!Array.isArray(users) || !isValidId(orgId)) {
      throw getErrorResponseObj({
        errorMsg: `Invalid user IDs or ${appInfo.account_type_txt.singular} ID.`,
        solution: `Please provide a valid list of user IDs and ${appInfo.account_type_txt.singular} ID.`,
      });
    }

    if (!isValidId(loggedInUserId)) {
      throw getErrorResponseObj({
        errorMsg: "Cannot process this request as invalid logged-in user.",
        solution: "Please login again and try again.",
      });
    }

    if (addPermissionCheck) await checkWriteAccess(orgId, loggedInUserId, c);

    const records = users.map(({ user_id, role_id, user_opinion }) => {
      return {
        org_id: orgId,
        user_id,
        org_user_role_id: role_id,
        user_opinion:
          user_opinion >= 0
            ? user_opinion
            : user_id === loggedInUserId
              ? INVITATION_ENUMS.ACCEPTED
              : INVITATION_ENUMS.INVITED,
      };
    });

    const userIds = users.map((rec) => rec.user_id).join(",");

    const sql = `SELECT org_user_is_active as is_active, org_user_role_id, user_id FROM auth_organization_users_tbl 
                 WHERE org_id = ${orgId} AND user_id IN (${userIds});`;

    const earlierOrgMembersRaw = (await executeSql(sql, c)) as any[];
    const earlierOrgMemberIds = earlierOrgMembersRaw.map((rec) => rec.user_id);

    let updatedRecords;
    if (earlierOrgMemberIds && earlierOrgMemberIds.length > 0) {
      const needToUpdateRecords = records.filter((rec) =>
        earlierOrgMemberIds.includes(rec.user_id),
      );

      const requestObjUpdate = {
        users: needToUpdateRecords,
        orgId: orgId,
        loggedInUserId,
      };

      const getReqData = (user: any) => ({
        org_user_is_active: true,
        org_user_role_id: ROLES.IS_VALID_ROLE_ID(user.org_user_role_id)
          ? user.org_user_role_id
          : ROLES.READ,
      });

      const formatResponse = (req: any) => ({
        role_id: "org_user_role_id" in req ? req.org_user_role_id : ROLES.READ,
      });

      const updatedRecordsRes = (await updateOrgMembersInOrg(
        requestObjUpdate,
        getReqData,
        formatResponse,
        c,
      )) as any;
      if (updatedRecordsRes.success) {
        const { result: updateResults } = updatedRecordsRes.response;

        updatedRecords = updateResults.map((rec: any) => {
          return { ...rec.changedFor, ...rec.updatedData };
        });
      }
    }

    const needToInsertRecords = records.filter(
      (rec) => !earlierOrgMemberIds.includes(rec.user_id),
    );
    let insertedRecords;
    if (needToInsertRecords && needToInsertRecords.length > 0) {
      await insertRecords(
        "auth_organization_users_tbl",
        needToInsertRecords,
        c,
      );
      insertedRecords = needToInsertRecords;

      for (const rec of needToInsertRecords) {
        await invalidateOrgUserCacheForUser(rec.org_id, rec.user_id);
      }
    }

    return { insertedRecords, updatedRecords };
  } catch (error: any) {
    if (
      error &&
      (error.code === "ER_DUP_ENTRY" ||
        String(error.message).includes("UNIQUE constraint failed"))
    ) {
      throw getErrorResponseObj(
        {
          errorMsg: "Some of users are might already exists.",
          solution:
            "Please use add users which are not in this org or contact support.",
        },
        error,
      );
    }

    throw throwErrorInResponseIfErrorIsNotCustom(null, error, {
      errorMsg: `An error occurred while ${appInfo.account_type_txt.singular} add team members.`,
      solution:
        "Please try again later or contact support if the issue persists.",
    });
  }
};
