import type { Context } from "hono";
import type { IHonoAppBinding } from "../../../types.js";
import {
  executeSql,
  getErrorResponseObj,
  getResponseObj,
  IEmailUserIdMapping,
  initializeConnection,
  insertRecordsIgnore,
  isEmailValid,
  isValidId,
  IUnregisteredUsers,
  logger,
  sendSuccessResponse,
  throwErrorInResponseIfErrorIsNotCustom,
} from "../../../utils";
import { checkWriteAccess, includeUsersInOrg } from "./org-member-utils.js";
import { checkCanAllowToIncludeUsersInOrg } from "../premium-org-utils.js";
import { appInfo } from "../../../config/app-config.js";
import { getInvitationEmailTpl } from "../org-utils.js";
import sendEmail from "../../../utils/email-helper.js";

const addUsersInInvitedUsersTbl = async (
  unregisteredUsers: IUnregisteredUsers[],
  orgId: number,
  invitedByUserId: number,
  c: Context<IHonoAppBinding>,
) => {
  if (!unregisteredUsers.length) {
    return 0;
  }

  const records = unregisteredUsers.map((u) => ({
    org_id: orgId,
    email: u.email,
    invited_user_role_id: u.role_id,
    invited_by_user_id: invitedByUserId,
  }));

  try {
    // Use INSERT OR IGNORE for SQLite/D1
    const meta = await insertRecordsIgnore(
      "auth_invited_users_tbl",
      records,
      c,
    );

    return meta.changes;
  } catch (error: any) {
    logger.error(
      "Error while adding users in invited users table from addUsersInInvitedUsersTbl.",
      error,
    );
    // catastrophic failure (SQL syntax, table missing, etc.)
    return 0;
  }
};

const sendInvitationEmail = async (
  emails: string[],
  invitationFrom_userId: number,
  invitationTo_orgId: number,
  c: Context<IHonoAppBinding>,
) => {
  //Step 1: Validate inputs
  if (
    !emails ||
    emails.length <= 0 ||
    !isValidId(invitationFrom_userId) ||
    !isValidId(invitationTo_orgId)
  )
    return;

  try {
    //Step 2: Get organization name
    const orgSql = `SELECT org_name from auth_organization_tbl WHERE org_id=${invitationTo_orgId}`;
    const orgsResult = (await executeSql(orgSql, c)) as any[];
    const organizationName = orgsResult[0]?.org_name || "";

    if (!organizationName) {
      logger.error(
        "Error while adding users in invited users table from addUsersInInvitedUsersTbl.",
        new Error(),
      );
      return;
    }

    //Step 3: Get registered user details
    const emailList = emails.map((em) => `"${em}"`).join(", ");
    const usersSql = `SELECT user_email, user_fname as fname, user_lname as lname, user_id FROM auth_users_tbl 
                      WHERE user_email IN (${emailList}) OR user_id=${invitationFrom_userId} AND user_is_active = 1`;

    const usersResult = (await executeSql(usersSql, c)) as any[];
    const emailUserMap: Record<string, any> = {};

    //Prepare email user map, and inviter name
    let inviterName = "";
    usersResult.forEach((user: any) => {
      //gather all emails for registered users
      emailUserMap[user.user_email] = user;

      //gather inviter name
      if (user.user_id === invitationFrom_userId) {
        inviterName = `${user.fname} ${user.lname} (${user.user_email})`;
      }
    });

    //iterating over all emails (registered and unregistered)
    for (const email of emails) {
      //Step 4: Create email template

      //get user details
      const userObj = emailUserMap[email];

      //check if user is registered
      const isUserHaveAnAccount = !!userObj;

      //get user name, if user is registered else, use email as user name
      const userName = isUserHaveAnAccount
        ? `${userObj.fname} ${userObj.lname}`
        : email;

      //get email template
      const emailTemplate = getInvitationEmailTpl({
        invitedTo_UserName: userName,
        organizationName,
        inviterName,
        isUserHaveAnAccount,
      });

      try {
        //Step 5: Send email
        await sendEmail({
          email,
          subject: `${appInfo.appName} - Invitation to Join ${organizationName}`,
          html: emailTemplate,
        });
      } catch (error: any) {
        logger.error(
          "Error while sending an invitation email from sendInvitationEmail for email " +
            email,
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
      //Step 1: Gather valid emails only.
      const validEmails: string[] = [];
      for (const userEntry of needToIncludeUsers) {
        if (!isEmailValid(userEntry.email)) continue;
        validEmails.push(userEntry.email);
      }

      if (validEmails.length === 0) {
        throw getErrorResponseObj({
          errorMsg: "No valid email addresses provided.",
          solution: "Please provide a valid list of email addresses.",
        });
      }

      //Step 2: Check write access
      await checkWriteAccess(reqBody.org_id, user?.id, c);

      //Step 3: Get user ids for registered users from email
      const emailList = validEmails.map((em) => `"${em}"`).join(", ");
      const sql = `SELECT user_email, user_id FROM auth_users_tbl WHERE user_email IN (${emailList}) AND user_is_active = 1;`;

      const resultEmailUserIds = (await executeSql(
        sql,
        c,
      )) as unknown as IEmailUserIdMapping[];

      //Create a map of email to user id for quick lookup
      const emailUserIdMap: Record<string, number> = {};
      resultEmailUserIds.forEach((element) => {
        emailUserIdMap[element.user_email] = element.user_id;
      });

      //Step 4: Separate registered and unregistered users
      const registeredUsers: { role_id: number; user_id: number }[] = [];
      const unRegisteredUsers: { role_id: number; email: string }[] = [];

      for (const userEntry of needToIncludeUsers) {
        if (!isEmailValid(userEntry.email)) continue;

        if (userEntry.email in emailUserIdMap) {
          //here means, the user is exists in the system
          registeredUsers.push({
            role_id: userEntry.role_id,
            user_id: emailUserIdMap[userEntry.email],
          });
          continue;
        }

        //here means, the user is not exists in the system
        unRegisteredUsers.push({
          role_id: userEntry.role_id,
          email: userEntry.email,
        });
      }

      //Step 5: Check if the organization can allow to include more users
      await checkCanAllowToIncludeUsersInOrg(
        reqBody.org_id,
        registeredUsers.length + unRegisteredUsers.length,
        c,
      );

      //Step 6: Include registered users in the organization
      let registeredUsersResult;

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

      //Step 7: Add unregistered users in invited users table
      let invitedUnregisteredUsersResult;
      if (unRegisteredUsers.length > 0) {
        invitedUnregisteredUsersResult = await addUsersInInvitedUsersTbl(
          unRegisteredUsers,
          reqBody.org_id,
          user?.id,
          c,
        );
      }

      //Step 8: Send invitation emails to unregistered users
      c.executionCtx.waitUntil(
        sendInvitationEmail(validEmails, user?.id, reqBody.org_id, c),
      );

      //Step 9: Return the response
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
