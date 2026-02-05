import { Context } from "hono";
import { appInfo } from "../../app-config.js";
import { IHonoAppBinding } from "../../types.js";
import { getRequestFromRoute, isValidId } from "../../utils/common-utils.js";
import { ROLES } from "../../utils/enums.js";
import {
  getErrorResponseObj,
  getResponseObj,
  sendSuccessResponse,
  throwErrorInResponseIfErrorIsNotCustom,
} from "../../utils/response-utils.js";
import { initializeConnection, insertRecords } from "../../utils/sql-helper.js";
import { OrganizationFields } from "../../utils/type.js";
import { validateOrgRequestObj } from "../authentication/validator.js";
import { includeUsersInOrg } from "./org-members.js";

const insertOrg = async (
  requestObj: Record<string, any>,
  c: Context<IHonoAppBinding>,
  loggedInUserId: number,
) => {
  const fields: Array<string> = [
    "org_name",
    "org_address",
    "org_state",
    "org_country",
    "org_external_id",
  ];

  const reqBody = getRequestFromRoute(requestObj, fields) as OrganizationFields;
  reqBody.org_created_by = loggedInUserId;

  const isValid = validateOrgRequestObj(reqBody);
  if (isValid !== true) {
    throw getErrorResponseObj(isValid);
  }

  try {
    const result: any = await insertRecords(
      "auth_organization_tbl",
      [reqBody],
      c,
    );

    // Here means success
    return result;
  } catch (error: any) {
    // Handle duplicate entry error (D1 error message might be different, but keeping logic)
    if (
      error &&
      (error.code === "ER_DUP_ENTRY" ||
        String(error.message).includes("UNIQUE constraint failed"))
    ) {
      throw getErrorResponseObj(
        {
          errorMsg: `${appInfo.account_type_txt.singular} already exists.`,
          solution: `Please use a different ${appInfo.account_type_txt.singular} name or contact support.`,
        },
        error,
      );
    }

    throw getErrorResponseObj(
      {
        errorMsg:
          error.message ||
          `An error occurred while processing your ${appInfo.account_type_txt.singular} registration.`,
        solution:
          "Please try again later or contact support if the issue persists.",
      },
      error,
    );
  }
};

export const postOrgs = async (c: Context<IHonoAppBinding>) => {
  return await initializeConnection(async () => {
    try {
      const reqBody = (await c.req.json()) || {};
      const user = c.get("user");
      const loggedInUserId = user?.id;

      if (!isValidId(loggedInUserId)) {
        throw getErrorResponseObj({
          errorMsg: "Cannot create organization as invalid logged-in user.",
          solution: "Please login again and try again.",
        });
      }

      const insertedOrg = await insertOrg(reqBody, c, loggedInUserId);

      // In D1/SQLite last_row_id is used
      const org_id = insertedOrg?.last_row_id;
      reqBody["org_id"] = org_id;

      reqBody["included_users"] = []; //reqBody['included_users']
      reqBody["included_users"].push({
        user_id: loggedInUserId,
        role_id: ROLES.ADMIN,
      });

      const { insertedRecords } = await includeUsersInOrg(
        reqBody,
        loggedInUserId,
        c,
        false,
      );

      return sendSuccessResponse(
        c,
        getResponseObj({
          message: `${appInfo.account_type_txt.singular} has been registered successfully.`,
          insertedOrgId: org_id,
          insertedUserToOrg: insertedRecords,
        }),
      );
    } catch (error: any) {
      return throwErrorInResponseIfErrorIsNotCustom(c, error, {
        errorMsg: `An error occurred while ${appInfo.account_type_txt.singular.toLocaleLowerCase()} registration.`,
        solution:
          "Please try again later or contact support if the issue persists.",
      });
    }
  });
};
