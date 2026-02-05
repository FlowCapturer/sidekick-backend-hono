import { Context, Hono } from "hono";

import {
  getRequestFromRoute,
  hashPassword,
  isCustomError,
} from "../../utils/common-utils.js";
import { clearOTPFromCache, validateOTP } from "../../utils/otp-helper.js";
import {
  getErrorResponseObj,
  getResponseObj,
  sendErrorResponse,
  sendSuccessResponse,
} from "../../utils/response-utils.js";
import { initializeConnection, updateRecords } from "../../utils/sql-helper.js";
import { UsersFields } from "../../utils/type.js";
import { validatePassword } from "./validator.js";
import { IHonoAppBinding } from "../../types.js";

const resetPasswordRouter = new Hono<IHonoAppBinding>();

const updateUser = async (
  requestObj: Record<string, any>,
  c: Context<IHonoAppBinding>,
) => {
  const requiredFields: Array<string> = [
    // 'user_mobile_no',
    "user_email",
    "user_password",
    // 'user_fname',
    // 'user_lname',
    // 'user_is_active',
  ];

  const reqBody = getRequestFromRoute(
    requestObj,
    requiredFields,
  ) as UsersFields;

  try {
    if (!reqBody.user_password) {
      throw "EMPTY_PASSWORD";
    } else {
      const passwordValidation = validatePassword(reqBody.user_password);
      if (passwordValidation !== true) {
        throw passwordValidation;
      }
    }

    delete reqBody.user_is_active;

    const email = reqBody.user_email;
    delete reqBody.user_email;

    reqBody.user_password_hash = await hashPassword(
      reqBody.user_password || "",
    );
    delete reqBody.user_password;

    const result = await updateRecords(
      "auth_users_tbl",
      reqBody,
      { user_email: email },
      c,
    );

    // Here means success
    return result;
  } catch (error: any) {
    let responseError = {
      errorMsg: "An error occurred while resetting the password.",
      solution:
        "Please try again later or contact support if the issue persists.",
    };

    if (error === "EMPTY_PASSWORD") {
      responseError = {
        errorMsg: "Password cannot be empty.",
        solution: "Enter password and try again.",
      };
    } else if (error.errorMsg) {
      responseError = error;
    }

    throw getErrorResponseObj(responseError, error);
  }
};

resetPasswordRouter.put("/", async (c) => {
  /**
   * Request JSON can contain:
   * {
   *    user_email:
   *    user_password:
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
      await updateUser(reqBody, c);

      await clearOTPFromCache(reqBody.user_email);
      return sendSuccessResponse(
        c,
        getResponseObj({
          message: "Password has been updated successfully.",
        }),
      );
    } catch (error: any) {
      const responseError = isCustomError(error)
        ? error
        : getErrorResponseObj({
            errorMsg: `An error occurred while password reset.`,
            solution:
              "Please try again later or contact support if the issue persists.",
          });

      return sendErrorResponse(c, responseError);
    }
  });
});

export default resetPasswordRouter;
