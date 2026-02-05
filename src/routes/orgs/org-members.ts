import { Context, Hono } from "hono";
import { appInfo } from "../../config/app-config.js";
import { IHonoAppBinding } from "../../types.js";
import {
  getRequestFromRoute,
  isEmailValid,
  isValidId,
} from "../../utils/common-utils.js";
import sendEmail from "../../utils/email-helper.js";
import { INVITATION_ENUMS, ROLES } from "../../utils/enums.js";
import logger from "../../utils/error-logger.js";
import {
  getErrorResponseObj,
  getResponseObj,
  sendErrorResponse,
  sendSuccessResponse,
  throwErrorInResponseIfErrorIsNotCustom,
} from "../../utils/response-utils.js";
import {
  executeSql,
  initializeConnection,
  insertRecords,
  updateRecords,
} from "../../utils/sql-helper.js";
import {
  IOrgMemberReq,
  IOrgMemberIsAdminSql,
  IOrgMemberUpdateReq,
  IOrgMemberIsActiveSql,
  IUpdateOrgMemberResponse,
  IUpdateOrgMemberResultResponse,
  IEmailUserIdMapping,
  IUnregisteredUsers,
} from "../../utils/type.js";
import {
  canWriteOrg,
  getInvitationEmailTpl,
  getOrgCreatedBy,
  invalidateOrgUserCacheForUser,
} from "./org-utils.js";
import { checkCanAllowToIncludeUsersInOrg } from "./premium-org-utils.js";

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

const checkWriteAccess = async (
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

const updateOrgMembersInOrg = async (
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
    users: body.users,
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

const deleteUsersInOrg = async (c: Context<IHonoAppBinding>) => {
  const body = await c.req.json();
  const user = c.get("user");

  return await initializeConnection(async () => {
    try {
      const requestObj = {
        users: body.users,
        orgId: body.org_id,
        loggedInUserId: parseInt(user?.id, 10),
      };

      const orgCreatedBy = (await getOrgCreatedBy(
        requestObj.orgId,
        c,
      )) as number;
      const getReqData = (user: any) => {
        if (user?.user_id === orgCreatedBy) {
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

const addUsersInOrg = async (c: Context<IHonoAppBinding>) => {
  const reqBody = (await c.req.json()) || {};
  const user = c.get("user");

  return await initializeConnection(async () => {
    try {
      const result = await includeUsersInOrg(reqBody, user?.id, c, true);

      await checkCanAllowToIncludeUsersInOrg(reqBody.org_id, c);

      return sendSuccessResponse(c, getResponseObj(result));
    } catch (error: any) {
      return throwErrorInResponseIfErrorIsNotCustom(c, error, {
        errorMsg: `An error occurred while adding new team member in ${appInfo.account_type_txt.singular}.`,
        solution:
          "Please try again later or contact support if the issue persists.",
      });
    }
  });
};

const addUsersInInvitedUsersTbl = async (
  unregisteredUsers: IUnregisteredUsers[],
  orgId: number,
  invitedByUserId: number,
  c: Context<IHonoAppBinding>,
) => {
  const passedRecs = [],
    failedRecs = [];

  for (const element of unregisteredUsers) {
    const insertRec = {
      org_id: orgId,
      email: element.email,
      invited_user_role_id: element.role_id,
      invited_by_user_id: invitedByUserId,
    };

    try {
      const result: any = await insertRecords(
        "auth_invited_users_tbl",
        [insertRec],
        c,
      );

      if (result.changes === 1) passedRecs.push(insertRec);
      else
        failedRecs.push({
          record: insertRec,
          error: result,
        });
    } catch (error: any) {
      let cError = error;

      if (
        error &&
        (error.code === "ER_DUP_ENTRY" ||
          String(error.message).includes("UNIQUE constraint failed"))
      ) {
        cError = {
          errorMsg: `Invitation has been already sent to this (${insertRec.email}) user earlier.`,
          solution: `This user is already in your ${appInfo.account_type_txt.singular}.`,
        };
      }

      failedRecs.push({
        record: insertRec,
        error: cError,
      });
    }
  }

  return { passedRecs, failedRecs };
};

const sendInvitationEmail = async (
  emails: string[],
  invitationFrom_userId: number,
  invitationTo_orgId: number,
  c: Context<IHonoAppBinding>,
) => {
  if (
    !emails ||
    emails.length <= 0 ||
    !isValidId(invitationFrom_userId) ||
    !isValidId(invitationTo_orgId)
  )
    return;

  try {
    const orgSql = `SELECT org_name from auth_organization_tbl WHERE org_id=${invitationTo_orgId}`;
    const orgsResult = (await executeSql(orgSql, c)) as any[];
    const organizationName = orgsResult[0]?.org_name || "";

    if (!organizationName) {
      throw new Error(
        `${appInfo.account_type_txt.singular} not found, error from method sendInvitationEmail`,
      );
    }

    const emailList = emails.map((em) => `"${em}"`).join(", ");
    const usersSql = `SELECT user_email, user_fname as fname, user_lname as lname, user_id FROM auth_users_tbl WHERE user_email IN (${emailList}) OR user_id=${invitationFrom_userId} AND user_is_active = 1`;
    const usersResult = (await executeSql(usersSql, c)) as any[];
    const emailUserMap: Record<string, any> = {};

    let inviterName = "";
    usersResult.forEach((user: any) => {
      emailUserMap[user.user_email] = user;

      if (user.user_id === invitationFrom_userId) {
        inviterName = `${user.fname} ${user.lname} (${user.user_email})`;
      }
    });

    for (const email of emails) {
      const userObj = emailUserMap[email];
      const userName = userObj ? `${userObj.fname} ${userObj.lname}` : email;
      const isUserHaveAnAccount = !!userObj;

      const emailTemplate = getInvitationEmailTpl({
        invitedTo_UserName: userName,
        organizationName,
        inviterName,
        isUserHaveAnAccount,
      });

      try {
        await sendEmail({
          email,
          subject: `${appInfo.appName} - Invitation to Join ${organizationName}`,
          html: emailTemplate,
        });
      } catch (error: any) {
        logger.error(
          "Error while actual sending an invitation email from sendInvitationEmail.",
          error,
        );
      }
    }
  } catch (error: any) {
    logger.error(
      "Error while calculating an invitation emails from sendInvitationEmail.",
      error,
    );
  }
};

const addUsersByEmail = async (c: Context<IHonoAppBinding>) => {
  const reqBody = (await c.req.json()) || {};
  const needToIncludeUsers = reqBody.included_users;
  const user = c.get("user");

  return await initializeConnection(async () => {
    try {
      const emails: string[] = [];
      for (const userEntry of needToIncludeUsers) {
        if (!isEmailValid(userEntry.email)) continue;
        emails.push(userEntry.email);
      }

      await checkWriteAccess(reqBody.org_id, user?.id, c);

      const emailList = emails.map((em) => `"${em}"`).join(", ");
      const sql = `SELECT user_email, user_id FROM auth_users_tbl WHERE user_email IN (${emailList}) AND user_is_active = 1;`;

      const resultEmailUserIds = (await executeSql(
        sql,
        c,
      )) as unknown as IEmailUserIdMapping[];
      const emailUserIdMap: Record<string, number> = {};

      resultEmailUserIds.forEach((element) => {
        emailUserIdMap[element.user_email] = element.user_id;
      });

      const unRegisteredUsers = [];
      const registeredUsers = [];

      for (const userEntry of needToIncludeUsers) {
        if (userEntry.email in emailUserIdMap) {
          registeredUsers.push({
            role_id: userEntry.role_id,
            user_id: emailUserIdMap[userEntry.email],
          });
          continue;
        }

        unRegisteredUsers.push({
          role_id: userEntry.role_id,
          email: userEntry.email,
        });
      }

      let registeredUsersResult, invitedUnregisteredUsersResult;

      if (registeredUsers.length > 0) {
        const addTeamMembers = {
          org_id: reqBody.org_id,
          included_users: registeredUsers,
        };

        registeredUsersResult = await includeUsersInOrg(
          addTeamMembers,
          user?.id,
          c,
          true,
        );
      }

      if (unRegisteredUsers.length > 0) {
        invitedUnregisteredUsersResult = await addUsersInInvitedUsersTbl(
          unRegisteredUsers,
          reqBody.org_id,
          user?.id,
          c,
        );
      }

      await checkCanAllowToIncludeUsersInOrg(reqBody.org_id, c);

      c.executionCtx.waitUntil(
        sendInvitationEmail(emails, user?.id, reqBody.org_id, c),
      );

      return sendSuccessResponse(
        c,
        getResponseObj({
          registeredUsers: registeredUsersResult,
          unregisteredUsers: invitedUnregisteredUsersResult,
        }),
      );
    } catch (error: any) {
      return throwErrorInResponseIfErrorIsNotCustom(c, error, {
        errorMsg: `An error occurred while adding new team member in ${appInfo.account_type_txt.singular.toLocaleLowerCase()}.`,
        solution:
          "Please try again later or contact support if the issue persists.",
      });
    }
  });
};

const deleteUnregisteredUserInvitation = async (
  c: Context<IHonoAppBinding>,
) => {
  const user = c.get("user");
  const loggedInUserId = parseInt(user?.id, 10);
  const body = await c.req.json();
  const { org_id: orgId, invited_users_id } = body;

  const updateDB = async (isDelete: number): Promise<any> => {
    try {
      const updateData = { is_deleted: isDelete };
      const whereClause = { org_id: orgId, invited_users_id };

      const responseObj: any = await updateRecords(
        "auth_invited_users_tbl",
        updateData,
        whereClause,
        c,
      );
      const success = responseObj.changes > 0;

      if (success) {
        return sendSuccessResponse(
          c,
          getResponseObj({ ...updateData, ...whereClause }),
        );
      }

      throw getErrorResponseObj({
        errorMsg: `Error occurred while deleting an unregistered user's invitation.`,
        solution:
          "Please try again later or contact support if the issue persists.",
      });
    } catch (error: any) {
      if (
        error &&
        (error.code === "ER_DUP_ENTRY" ||
          String(error.message).includes("UNIQUE constraint failed")) &&
        isDelete < 5
      ) {
        return await updateDB(isDelete + 1);
      }
      throw error;
    }
  };

  return await initializeConnection(async () => {
    try {
      if (!isValidId(orgId) || !isValidId(invited_users_id)) {
        throw getErrorResponseObj({
          errorMsg: `Unable to delete this user for an invalid organization-id or user-id.`,
          solution:
            "Error occurred while deleting an unregistered user's invitation.",
        });
      }

      await checkWriteAccess(orgId, loggedInUserId, c);

      return await updateDB(1);
    } catch (error: any) {
      return throwErrorInResponseIfErrorIsNotCustom(c, error, {
        errorMsg:
          "Error encountered while deleting an unregistered user's invitation.",
        solution: "",
      });
    }
  });
};

const orgMembersRouter = new Hono<IHonoAppBinding>();

orgMembersRouter.post("/by-emails", addUsersByEmail);
orgMembersRouter.get("/:orgId", getOrgMembers);
orgMembersRouter.put("/", editUsersInOrg);
orgMembersRouter.delete("/", deleteUsersInOrg);
orgMembersRouter.post("/", addUsersInOrg);
orgMembersRouter.delete(
  "/unregistered-user-invitation",
  deleteUnregisteredUserInvitation,
);

export default orgMembersRouter;
