import type { Context } from "hono";
import type { IHonoAppBinding } from "../../../types.js";
import { canWriteOrg, invalidateOrgUserCacheForUser } from "../org-utils.js";
import {
  executeSql,
  getErrorResponseObj,
  getResponseObj,
  insertRecords,
  INVITATION_ENUMS,
  IOrgMemberIsActiveSql,
  IOrgMemberIsAdminSql,
  IOrgMemberUpdateReq,
  isValidId,
  logger,
  ROLES,
  throwErrorInResponseIfErrorIsNotCustom,
  updateRecords,
} from "../../../utils/index.js";
import { appInfo } from "../../../config/app-config.js";

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
  const { needToUpdateRecords, orgId, loggedInUserId } = requestObj;

  //Step 1: Validate the request
  if (
    !Array.isArray(needToUpdateRecords) ||
    !isValidId(orgId) ||
    needToUpdateRecords.length <= 0
  ) {
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
    //Step 2: Permission checks
    await checkWriteAccess(orgId, loggedInUserId, c);

    const result = [];
    let someFailed = false;

    //Step 3: Update the records
    for (const user of needToUpdateRecords) {
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

        //Step 4: Invalidate the cache for the updated user
        if (success) {
          await invalidateOrgUserCacheForUser(
            whereClause.org_id,
            whereClause.user_id,
          );
        }

        result.push({
          success,
          changedFor: whereClause,
          updatedData: success ? formatResponse(needToSETData) : {},
        });
      } catch (error: any) {
        someFailed = true;
        logger.error(
          `Error while updating team member details for orgId=${orgId}, loggedInUserId=${loggedInUserId}, error: `,
          error,
        );
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
  requestObj: {
    included_users: Array<{
      user_id: number;
      role_id: number;
      user_opinion?: number;
    }>;
    org_id: number;
  },
  loggedInUserId: number,
  c: Context<IHonoAppBinding>,
  addPermissionCheck: boolean = true,
) => {
  const { included_users: includeUsers, org_id: orgId } = requestObj;

  try {
    //Step 1: Validate the request
    if (!Array.isArray(includeUsers) || !isValidId(orgId)) {
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

    //Step 2: Permission check
    if (addPermissionCheck) await checkWriteAccess(orgId, loggedInUserId, c);

    //Step 3: Prepare the records
    const records = includeUsers.map(({ user_id, role_id, user_opinion }) => {
      return {
        org_id: orgId,
        user_id,
        org_user_role_id: role_id,
        user_opinion:
          user_opinion && user_opinion >= 0
            ? user_opinion
            : user_id === loggedInUserId
              ? INVITATION_ENUMS.ACCEPTED
              : INVITATION_ENUMS.INVITED,
      };
    });

    //Step 4: Get all user IDs to be included
    const userIds = includeUsers.map((rec) => rec.user_id).join(",");

    /**
     * Biz Rule:
     * Here, first checking from includeUsers, if they are already in list,
     * then just updating their new roleId and make them active,
     *      their opinion will be updated in different calls as per their action(ACCEPTED, REJECTED, INVITED)
     * else, just adding them to the list.
     */

    //Step 5: Get the earlier org members
    const sql = `SELECT org_user_is_active as is_active, org_user_role_id, user_id FROM auth_organization_users_tbl 
                 WHERE org_id = ${orgId} AND user_id IN (${userIds});`;

    const earlierOrgMembersRaw = (await executeSql(sql, c)) as any[];
    const earlierOrgMemberIds = earlierOrgMembersRaw.map((rec) => rec.user_id);

    //Step 6: Update the org member opinions, if they are in earlierOrgMemberIds
    let updatedRecords;
    if (earlierOrgMemberIds && earlierOrgMemberIds.length > 0) {
      const needToUpdateRecords = records.filter((rec) =>
        earlierOrgMemberIds.includes(rec.user_id),
      );

      const requestObjUpdate = {
        needToUpdateRecords,
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

      //Update new user opinions and make them active
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

    //Step 7: Insert the new org members
    const needToInsertRecords = records.filter(
      (rec) => !earlierOrgMemberIds.includes(rec.user_id),
    );

    let insertedRecords;
    if (needToInsertRecords && needToInsertRecords.length > 0) {
      //Insert new org members
      await insertRecords(
        "auth_organization_users_tbl",
        needToInsertRecords,
        c,
      );
      insertedRecords = needToInsertRecords;

      //Invalidate the cache for new org members only,
      //because in case of update, that logic is written in: updateOrgMembersInOrg
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
