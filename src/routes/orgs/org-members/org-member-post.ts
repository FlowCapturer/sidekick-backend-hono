import type { Context } from "hono";
import type { IHonoAppBinding } from "../../../types";
import {
  executeSql,
  getErrorResponseObj,
  getResponseObj,
  IEmailUserIdMapping,
  initializeConnection,
  insertRecords,
  isEmailValid,
  isValidId,
  IUnregisteredUsers,
  logger,
  sendSuccessResponse,
  throwErrorInResponseIfErrorIsNotCustom,
} from "../../../utils";
import { checkWriteAccess, includeUsersInOrg } from "./org-member-utils";
import { checkCanAllowToIncludeUsersInOrg } from "../premium-org-utils";
import { appInfo } from "../../../config/app-config";
import { getInvitationEmailTpl } from "../org-utils";
import sendEmail from "../../../utils/email-helper";

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

      if (emails.length === 0) {
        throw getErrorResponseObj({
          errorMsg: "No valid email addresses provided.",
          solution: "Please provide a valid list of email addresses.",
        });
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

export { addUsersByEmail };
