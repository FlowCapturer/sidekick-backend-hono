import type { Context } from "hono";
import type { IHonoAppBinding } from "../../../types.js";
import {
  getErrorResponseObj,
  getResponseObj,
  initializeConnection,
  isValidId,
  sendSuccessResponse,
  throwErrorInResponseIfErrorIsNotCustom,
  updateRecords,
} from "../../../utils/index.js";
import { checkWriteAccess } from "./org-member-utils.js";

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
      const success = responseObj?.changes > 0;

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

export { deleteUnregisteredUserInvitation };
