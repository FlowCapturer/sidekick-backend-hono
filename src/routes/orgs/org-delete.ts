import { Context } from "hono";
import { appInfo } from "../../app-config.js";
import { IHonoAppBinding } from "../../types.js";
import { isValidId } from "../../utils/common-utils.js";
import {
  getErrorResponseObj,
  getResponseObj,
  sendErrorResponse,
  sendSuccessResponse,
  throwErrorInResponseIfErrorIsNotCustom,
} from "../../utils/response-utils.js";
import { initializeConnection, updateRecords } from "../../utils/sql-helper.js";
import { canWriteOrg } from "./org-utils.js";

export const deleteOrg = async (c: Context<IHonoAppBinding>) => {
  const id = c.req.param("id");
  const orgId = Number(id);

  if (isValidId(orgId) === false) {
    return sendErrorResponse(
      c,
      getErrorResponseObj({
        errorMsg: "OrgId not found in params.",
        solution:
          "Kindly try by re-login or contact support if the issue persists.",
      }),
    );
  }

  const user = c.get("user");
  const loggedInUserId = user?.id;

  if (isValidId(loggedInUserId) === false) {
    return sendErrorResponse(
      c,
      getErrorResponseObj({
        errorMsg: "UserId not found in your API key.",
        solution:
          "Kindly try by re-login or contact support if the issue persists.",
      }),
    );
  }

  return await initializeConnection(async () => {
    try {
      if ((await canWriteOrg(loggedInUserId, orgId, c)) === false) {
        return sendErrorResponse(
          c,
          getErrorResponseObj({
            errorMsg: `You are not allowed to delete this ${appInfo.account_type_txt.singular.toLocaleLowerCase()}.`,
            solution: `As you are not the administrator for this ${appInfo.account_type_txt.singular.toLocaleLowerCase()}.`,
          }),
        );
      }

      const responseObj: any = await updateRecords(
        "auth_organization_tbl",
        { org_is_deleted: true },
        { org_id: orgId },
        c,
      );

      if (responseObj.changes > 0) {
        return sendSuccessResponse(
          c,
          getResponseObj({
            message: `${appInfo.account_type_txt.singular} has been deleted successfully.`,
          }),
        );
      }

      throw {
        errMsg: "No rows were affected.",
      };
    } catch (error: any) {
      return throwErrorInResponseIfErrorIsNotCustom(c, error, {
        errorMsg: `Encountered an error while deleting this ${appInfo.account_type_txt.singular.toLocaleLowerCase()}.`,
        solution: "Error occurred while communicating with database.",
      });
    }
  });
};
