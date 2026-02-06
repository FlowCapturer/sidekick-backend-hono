import { Context, Hono } from "hono";
import { getRequestFromRoute, hashPassword } from "../../utils/common-utils.js";
import { INVITATION_ENUMS } from "../../utils/enums.js";
import logger from "../../utils/error-logger.js";
import { clearOTPFromCache, validateOTP } from "../../utils/otp-helper.js";
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
import { UsersFields } from "../../utils/type.js";
import { validateUserRequestObj } from "./validator.js";
import { IHonoAppBinding } from "../../types.js";
import { includeUsersInOrg } from "../orgs/org-members/org-member-utils.js";

const userRegistrationRouter = new Hono<IHonoAppBinding>();

const insertUser = async (
  requestObj: Record<string, any>,
  c: Context<IHonoAppBinding>,
) => {
  const requiredFields: Array<string> = [
    "user_email",
    "user_mobile_no",
    "user_password",
    "user_fname",
    "user_lname",
    "user_is_active",
  ];

  const reqBody = getRequestFromRoute(
    requestObj,
    requiredFields,
  ) as UsersFields;

  const isValid = validateUserRequestObj(reqBody);
  if (isValid !== true) {
    throw getErrorResponseObj(isValid as any);
  }

  try {
    delete reqBody.user_is_active;

    //encrypting password
    reqBody.user_password_hash = await hashPassword(
      reqBody.user_password || "",
    );
    delete reqBody.user_password;

    const result: any = await insertRecords("auth_users_tbl", [reqBody], c);

    // Here means success
    return result;
  } catch (error: any) {
    // Handle duplicate entry error (Cloudflare D1 error message check might be different)
    if (
      error &&
      (error.code === "ER_DUP_ENTRY" ||
        error.message?.includes("UNIQUE constraint failed"))
    ) {
      throw getErrorResponseObj(
        {
          errorMsg: "User already exists.",
          solution:
            "Please use a different email or contact support if you believe this is an error.",
        },
        error,
      );
    }

    throw getErrorResponseObj(
      {
        errorMsg: "An error occurred while processing your user registration.",
        solution:
          "Please try again later or contact support if the issue persists.",
      },
      error,
    );
  }
};

const processInvitedUsers = async (
  email: string,
  userId: number,
  c: Context<IHonoAppBinding>,
) => {
  //now checking this email is exist in our auth_invited_users_tbl table.
  const sql = `SELECT org_id, invited_user_role_id, invited_users_id FROM auth_invited_users_tbl WHERE email = ? AND is_deleted = 0`;
  const invitedUserResult = await executeSql(sql, c, [email]);

  const succeeded: any[] = [];
  const errors: any[] = [];

  if (invitedUserResult.length <= 0) return { succeeded, errors };

  //Add this user in auth_organization_users_tbl
  for (const element of invitedUserResult as any[]) {
    const addTeamMembers = {
      org_id: element.org_id,
      included_users: [
        {
          role_id: element.invited_user_role_id,
          user_id: userId,
          user_opinion: INVITATION_ENUMS.INVITED,
        },
      ],
    };

    try {
      const registeredUsersResult = await includeUsersInOrg(
        addTeamMembers,
        userId,
        c,
        false,
      );

      succeeded.push(registeredUsersResult);

      await updateRecords(
        "auth_invited_users_tbl",
        { is_deleted: 1 },
        { invited_users_id: element.invited_users_id },
        c,
      );
    } catch (error: any) {
      errors.push(error);
      logger.error(
        `Error while adding user (userId: ${userId}) in organization: ${element.org_id}`,
        error,
      );
    }
  }

  return { succeeded, errors };
};

userRegistrationRouter.post("/", async (c) => {
  /**
   * Request JSON can contain:
   * {
   *    user_email:
   *    user_mobile_no:
   *    user_password:
   *    user_fname:
   *    user_lname:
   *    otp:
   * }
   */
  const reqBody = await c.req.json();

  if ((await validateOTP(reqBody.user_email, reqBody.otp)) === false) {
    const responseError = getErrorResponseObj({
      errorMsg: "Invalid OTP.",
      solution: "Enter correct OTP and try again.",
    });
    return sendErrorResponse(c, responseError);
  }

  return await initializeConnection(async () => {
    try {
      const insertedUser = await insertUser(reqBody, c);
      //here means, the user has been inserted successfully.

      const insertedUserId =
        insertedUser?.lastRowId ||
        insertedUser?.insertId ||
        insertedUser?.last_row_id;

      const { succeeded: addedOrgMembers, errors } = await processInvitedUsers(
        reqBody.user_email,
        insertedUserId,
        c,
      );

      await clearOTPFromCache(reqBody.user_email);
      return sendSuccessResponse(
        c,
        getResponseObj({
          message: `User has been registered successfully. ${errors.length > 0 ? "But some errors occurred while adding user in organization." : ""}`,
          insertedUserId,
          addedOrgMembers,
          // errors,
        }),
      );
    } catch (error: any) {
      //here, error means always in correct format.
      return throwErrorInResponseIfErrorIsNotCustom(c, error, {
        errorMsg: "An error occurred while user registration.",
        solution:
          "Please try again later or contact support if the issue persists.",
      });
    }
  });
});

export default userRegistrationRouter;
