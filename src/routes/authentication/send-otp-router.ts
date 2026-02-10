import { Context, Hono } from "hono";

import { appInfo } from "../../config/app-config.js";
import {
  generateOTP,
  isCustomError,
  isEmailValid,
} from "../../utils/common-utils.js";
import sendEmail from "../../utils/email-helper.js";
import { otpTemplate, setOTPInCache } from "../../utils/otp-helper.js";
import {
  getErrorResponseObj,
  sendErrorResponse,
  getResponseObj,
  sendSuccessResponse,
} from "../../utils/response-utils.js";
import { initializeConnection, selectRecords } from "../../utils/sql-helper.js";
import { IHonoAppBinding } from "../../types.js";
import { getFeatureFlags } from "../feature-flags/feature-flags.js";

const sendOTPRouterRouter = new Hono<IHonoAppBinding>();

const getUserById = async (email: string, c: Context<IHonoAppBinding>) => {
  let records: any = [];
  try {
    await initializeConnection(async () => {
      //checking if user already registered
      records = await selectRecords(
        "auth_users_tbl",
        ["user_id", "user_email"],
        { user_email: email },
        c,
      );
    });
  } catch (error: any) {
    throw getErrorResponseObj(
      {
        errorMsg: "Error while fetching user details by email.",
        solution:
          "Please try again later or contact support if the issue persists.",
      },
      error,
    );
  }
  return records;
};

sendOTPRouterRouter.post("/:path", async (c) => {
  /**
   * Request JSON can contain:
   * {
   *    email:
   * }
   */

  const { email }: { email: string } = await c.req.json();

  const path = c.req.param("path");

  if (isEmailValid(email) === false) {
    return sendErrorResponse(
      c,
      getErrorResponseObj({
        errorMsg: "Email is invalid.",
        solution: "Please recheck you email and try again.",
      }),
    );
  }

  if (getFeatureFlags().ff_enable_email_related_features === false) {
    return sendSuccessResponse(
      c,
      getResponseObj({
        message: "Email related features are disabled.",
        email,
      }),
    );
  }

  try {
    const records = await getUserById(email, c);
    let subject = "";

    if (path === "new-registration") {
      if (records && records.length > 0) {
        throw getErrorResponseObj({
          errorMsg: "User already exists.",
          solution:
            "Please use a different email or contact support if you believe this is an error.",
        });
      }

      subject = "OTP for Email Verification";
    } else if (path === "forgot-password") {
      if (records && records.length === 0) {
        throw getErrorResponseObj({
          errorMsg: "You don't have an account",
          solution: "Please register to create an account",
        });
      }
      subject = "OTP for Reset Password";
    } else {
      throw getErrorResponseObj({
        errorMsg: "Invalid path parameter.",
      });
    }

    const otp = generateOTP();
    await setOTPInCache(c.env, email, otp);

    await sendEmail({
      email,
      subject: `${appInfo.appName} - ${subject}`,
      html: otpTemplate(otp),
    });

    return sendSuccessResponse(
      c,
      getResponseObj({
        message: "OTP has been sent successfully.",
        email,
      }),
    );
  } catch (error: any) {
    const responseError = isCustomError(error)
      ? error
      : getErrorResponseObj(
          {
            errorMsg: "An error occurred while sending an OTP.",
            solution:
              "Please try again later or contact support if the issue persists.",
          },
          error || {},
        );
    return sendErrorResponse(c, responseError);
  }
});

export default sendOTPRouterRouter;
