import { Hono } from "hono";

import { isValidId } from "../../utils/common-utils.js";
import logger from "../../utils/error-logger.js";
import {
  getErrorResponseObj,
  getResponseObj,
  sendSuccessResponse,
  throwErrorInResponseIfErrorIsNotCustom,
} from "../../utils/response-utils.js";
import { initializeConnection, updateRecords } from "../../utils/sql-helper.js";
import { invalidateSessionCacheForUser } from "./check-session.js";
import { IHonoAppBinding } from "../../types.js";

const userProfileRouter = new Hono<IHonoAppBinding>();

userProfileRouter.put("/:id", async (c) => {
  return await initializeConnection(async () => {
    try {
      const { user_mobile_no, user_fname, user_lname } = await c.req.json();
      const user = c.get("user");
      const loggedInUserId = user?.id;

      if (isValidId(loggedInUserId) === false) {
        throw getErrorResponseObj({
          errorMsg: "Invalid user ID.",
          solution: "Please provide a valid user ID and try again.",
        });
      }

      const user_id = c.req.param("id");
      if (Number(user_id) !== Number(loggedInUserId)) {
        throw getErrorResponseObj({
          errorMsg: "You are not authorized to update this user profile.",
          solution: "Please provide a valid user ID and try again.",
        });
      }

      const reqBody = { user_mobile_no, user_fname, user_lname };
      const result: any = await updateRecords(
        "auth_users_tbl",
        reqBody,
        { user_id: loggedInUserId },
        c,
      );
      const success = result.changes > 0;
      if (success) {
        invalidateSessionCacheForUser(loggedInUserId);
      }

      return sendSuccessResponse(c, getResponseObj({ success }));
    } catch (error: any) {
      logger.error("Error while saving user profile:", error);

      return throwErrorInResponseIfErrorIsNotCustom(c, error, {
        errorMsg: "An error occurred while saving user profile.",
        solution:
          "Please try again later or contact support if the issue persists.",
      });
    }
  });
});

export default userProfileRouter;
