import { Context } from "hono";
import { appInfo } from "../../config/app-config.js";
import { IHonoAppBinding } from "../../types.js";
import { isObjectEmpty, isValidId } from "../../utils/common-utils.js";
import {
  getErrorResponseObj,
  getResponseObj,
  sendErrorResponse,
  sendSuccessResponse,
  throwErrorInResponseIfErrorIsNotCustom,
} from "../../utils/response-utils.js";
import { initializeConnection, updateRecords } from "../../utils/sql-helper.js";
import { OrganizationFields } from "../../utils/type.js";
import { canWriteOrg } from "./org-utils.js";

export const putOrgs = async (c: Context<IHonoAppBinding>) => {
  const orgId = Number(c.req.param("id"));

  return await initializeConnection(async () => {
    try {
      if (!isValidId(orgId)) {
        throw getErrorResponseObj({
          errorMsg: `Invalid ${appInfo.account_type_txt.singular} details.`,
          solution: "Please provide correct information and try again.",
        });
      }

      const user = c.get("user");
      const loggedInUserId = user?.id;

      if ((await canWriteOrg(loggedInUserId, orgId, c)) === false) {
        return sendErrorResponse(
          c,
          getErrorResponseObj({
            errorMsg: `You are not allowed to edit this ${appInfo.account_type_txt.singular.toLocaleLowerCase()}.`,
            solution: `As you are not the administrator for this ${appInfo.account_type_txt.singular.toLocaleLowerCase()}.`,
          }),
        );
      }

      const reqBody: OrganizationFields = (await c.req.json()) || {};

      if (!isValidId(loggedInUserId)) {
        throw getErrorResponseObj({
          errorMsg: "Invalid logged-in user.",
          solution: "Please re-login and try again.",
        });
      }

      const updateRec: Partial<OrganizationFields> = {};

      if ("org_name" in reqBody) {
        updateRec.org_name = reqBody.org_name;
      }
      if ("org_address" in reqBody) {
        updateRec.org_address = reqBody.org_address;
      }
      if ("org_state" in reqBody) {
        updateRec.org_state = reqBody.org_state;
      }
      if ("org_country" in reqBody) {
        updateRec.org_country = reqBody.org_country;
      }
      if ("org_external_id" in reqBody) {
        updateRec.org_external_id = reqBody.org_external_id;
      }

      if (isObjectEmpty(updateRec)) {
        throw getErrorResponseObj({
          errorMsg: `Cannot update ${appInfo.account_type_txt.singular.toLocaleLowerCase()} for an invalid request params.`,
          solution: `Please provide correct ${appInfo.account_type_txt.singular.toLocaleLowerCase()} params and try again.`,
        });
      }

      const updatedResponse: any = await updateRecords(
        "auth_organization_tbl",
        updateRec,
        { org_id: orgId },
        c,
      );
      const success = updatedResponse.changes > 0;

      if (!success) {
        throw getErrorResponseObj(
          {
            errorMsg: "Error while updating the records.",
            solution: `Please provide correct ${appInfo.account_type_txt.singular.toLocaleLowerCase()} params and try again.`,
          },
          updatedResponse,
        );
      }

      return sendSuccessResponse(
        c,
        getResponseObj({
          message: `${appInfo.account_type_txt.singular} details has been updated successfully.`,
          record: updateRec,
        }),
      );
    } catch (error: any) {
      return throwErrorInResponseIfErrorIsNotCustom(c, error, {
        errorMsg:
          error.message ||
          `An error occurred while ${appInfo.account_type_txt.singular.toLocaleLowerCase()} update.`,
        solution:
          "Please try again later or contact support if the issue persists.",
      });
    }
  });
};
